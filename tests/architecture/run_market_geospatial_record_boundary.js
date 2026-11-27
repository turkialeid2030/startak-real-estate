'use strict';
const assert=require('node:assert/strict');
const g=require('../../src/geospatial/geospatial-evidence-governance'),m=require('../../src/market/market-evidence-governance');
const asOf='2026-09-10T12:00:00Z';
const geo={subjectId:'S',asOf,requiredEvidenceTypes:[],trustedVerifierIds:[],governedFreshnessPolicyIds:[]};
const market={marketContextId:'M',geographyKey:'G',assetType:'LAND',asOf,requiredEvidenceTypes:[],minimumCountPolicyId:'P',governedMinimumCountPolicies:{P:{}}};
let reads=0;
const getter=Object.defineProperty({},'evidenceType',{enumerable:true,get(){reads++;return 'CLOSED_SALE_TRANSACTION';}});
for(const [fn,base] of [[g.evaluateGeospatialEvidenceBundle,geo],[m.evaluateMarketEvidenceBundle,market]]){
 const o=fn({...base,evidenceRecords:[getter]});assert.equal(o.decisionReady,false);assert.equal(o.transactionAuthorized,false);assert.equal(reads,0);
 const nested=Object.defineProperty({},'pricePerSqmSar',{enumerable:true,get(){reads++;return 100;}});
 const x=fn({...base,evidenceRecords:[{evidenceType:'CLOSED_SALE_TRANSACTION',critical:true,normalizedValue:nested}]});
 assert.equal(x.records[0].normalizedValue,null);assert.equal(reads,0);
 const payload={x:1,nested:{y:2}};
 const y=fn({...base,evidenceRecords:[{evidenceType:'CLOSED_SALE_TRANSACTION',critical:true,normalizedValue:payload,observedAt:'2026-02-30'}]});
 assert.equal(y.records[0].observedAt,null);assert.equal(y.records[0].normalizedValue.nested.y,2);
 payload.nested.y=99;assert.equal(y.records[0].normalizedValue.nested.y,2);assert.ok(Object.isFrozen(y.records[0].normalizedValue.nested));
}
console.log('MARKET_GEOSPATIAL_RECORD_BOUNDARY=PASS synthetic=true sourceAuthority=false');

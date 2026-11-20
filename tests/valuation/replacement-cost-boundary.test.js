'use strict';
const assert=require('node:assert/strict');
const {detailedReplacementCost}=require('../../src/market/value-reconciliation-audit');

const baseline=Object.freeze({
  landArea:1000,landPricePerSqm:2000,
  components:[{area:1200,ratePerSqm:1800}],
  depreciationPct:20,finalRoundingStep:1000,
});
const good=detailedReplacementCost(baseline);
assert.equal(good.status,'ILLUSTRATIVE_UNVERIFIED');
assert.equal(good.valueSar,3728000);
assert.equal(good.certified,false);

const mustHold=(changes,reason)=>{
 const out=detailedReplacementCost({...baseline,...changes});
 assert.equal(out.status,'INCOMPLETE');
 assert.equal(out.valueSar,null);
 assert.equal(out.certified,false);
 assert.ok(out.issues.includes(reason),JSON.stringify(out.issues));
};
for(const malformed of [null,42,'row',[],{area:1200},[3]]) {
 const rows=Array.isArray(malformed)&&malformed.length===1?malformed:[malformed];
 mustHold({components:rows},'BUILDING_COMPONENT_INVALID_0');
}
mustHold({components:[...baseline.components,null]},'BUILDING_COMPONENT_INVALID_1');
mustHold({components:Array(31).fill({area:1,ratePerSqm:1})},
 'BUILDING_COMPONENTS_REQUIRED');
mustHold({components:[{area:1e15,ratePerSqm:1e15}]},
 'COST_TOTAL_OUT_OF_RANGE');
mustHold({landArea:1e15,landPricePerSqm:1e15},
 'COST_TOTAL_OUT_OF_RANGE');
assert.equal(detailedReplacementCost(baseline).valueSar,3728000,
 'synthetic baseline unchanged after rejected input');
console.log('REPLACEMENT_COST_BOUNDARY=PASS synthetic_only=true');

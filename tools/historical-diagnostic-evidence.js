'use strict';
const assert=require('node:assert/strict');
const kinds=new Set(['acceptance.json','local-ocr-acceptance.json','document-tables-acceptance.json']);
function validateHistoricalEvidence(e,kind,source){
  assert.ok(kinds.has(kind),'unknown evidence type');
  assert.ok(typeof source==='string'&&/^[a-f0-9]{40}$/.test(source),'exact source SHA required');
  assert.equal(e.sourceCommit,source);
  assert.ok(Number.isSafeInteger(e.checks)&&e.checks>0);
  const tables=kind==='document-tables-acceptance.json';
  const rows=tables?e.contexts:e.browsers;
  assert.ok(Array.isArray(rows));
  const actual=rows.map(b=>b.engine+':'+(b.width??b.viewport?.width)).sort();
  const expected=['chromium','firefox','webkit'].flatMap(b=>[390,1366].map(w=>b+':'+w)).sort();
  assert.deepEqual(actual,expected);
  let sum=0;
  for(const row of rows){
    assert.ok(Number.isSafeInteger(row.checks)&&row.checks>0);
    assert.equal(row.physicalDevice,false);
    sum+=row.checks;
    assert.ok(Number.isSafeInteger(sum));
    if(!tables)assert.equal(row.checksCompleted,sum,'cumulative count must match context deltas');
  }
  assert.equal(sum,e.checks,'total must equal independent context counts');
  if(tables){
    assert.equal(e.independentExtractionAccuracyQualified,false);
    assert.equal(e.sourceAuthenticationQualified,false);
    assert.equal(e.financialAdoptionAuthorized,false);
  }else if(kind==='local-ocr-acceptance.json'){
    assert.equal(e.independentAccuracyQualified,false);
    assert.equal(e.sourceAuthenticationQualified,false);
  }else{
    assert.equal(e.physicalDevicesTested,false);
    assert.equal(e.screenReaderTested,false);
    assert.equal(e.marketDataVerified,false);
  }
  return Object.freeze({contexts:rows.length,checks:sum});
}
module.exports={validateHistoricalEvidence};

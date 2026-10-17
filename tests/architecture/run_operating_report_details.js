'use strict';
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { operatingReportDetails } = require('../../src/app/operating-report-details');
const data = { status:'NOT_CALCULABLE', issues:[{code:'RUNOFF_CASE_DATE_INVALID',refId:'<script>bad</script>'}],
  historicalCollections:{status:'NOT_AVAILABLE',totals:{rentCollected:0}},
  rows:[{periodStart:'2026-09-01',periodEndExclusive:'2026-10-01',contractRent:100000,normalizedOpex:null,scheduledCapex:5000,contractNetAfterScheduledCapex:null}],
  cashScenario:{status:'PARTIAL_SCENARIO',rows:[{periodStart:'2026-09-01',openingMinor:1000000,receiptsMinor:20000000,operatingMinor:1200000,capexMinor:500000,otherInflowsMinor:0,otherOutflowsMinor:0,closingMinor:19300000}],
    liquidity:{minimumMinor:-200000,minimumDate:'2026-09-30'}} };
assert.equal(operatingReportDetails(null),'');
for (const locale of ['en','ar-SA']) {
  const html=operatingReportDetails(data,locale),doc=new JSDOM(html).window.document;
  assert.equal(doc.querySelectorAll('script').length,0);
  assert.ok(doc.body.textContent.includes('<script>bad</script>'));
  assert.ok(doc.body.textContent.includes('RUNOFF_CASE_DATE_INVALID'));
  assert.equal(doc.querySelectorAll('table').length,5);
  assert.ok(doc.body.textContent.includes('2026-09-30'));
  if(locale==='en'){
    assert.ok(doc.body.textContent.includes('193,000 SAR'));
    assert.ok(doc.body.textContent.includes('-2,000 SAR'));
    assert.ok(doc.body.textContent.includes('0 SAR'));
    assert.ok(doc.body.textContent.includes('Unavailable'));
  }
}
console.log('OPERATING_REPORT_DETAILS: PASS (periods, units, missing versus zero, negative liquidity, escaped references)');

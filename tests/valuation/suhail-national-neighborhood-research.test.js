'use strict';
const assert=require('node:assert/strict');
const {toPublicSample,parseResearchCsv,selectNeighborhoodRows,researchSummary}=require('../../src/market/suhail-national-neighborhood-research');
let n=0;function test(label,run){run();n++;console.log('PASS '+label);}
const sample=toPublicSample();
test('indexed public neighborhood rows span several cities, not just Riyadh',()=>{
 assert.equal(sample.length,10);
 assert.equal(researchSummary(sample).cityCount,6);
 assert.deepEqual(selectNeighborhoodRows(sample,{city:'شقراء'}).map(x=>x.district),['الصفراء']);
 assert.deepEqual(selectNeighborhoodRows(sample,{city:'الرياض'}).map(x=>x.district),
 ['غرناطة','التعاون','المروج','الملك سلمان']);
});
test('same neighborhood name in different cities never leaks into other cities',()=>{
 const csv='المدينة,الحي,عدد الإفراغات,إجمالي القيمة,متوسط سعر المتر سكني\nالرياض,العقيق,2,3000000,2500\nوادي الدواسر,العقيق,1,100000,200';
 const parsed=parseResearchCsv(csv);
 assert.equal(parsed.records.length,2);
 assert.equal(selectNeighborhoodRows(parsed.records,{city:'الرياض',district:'العقيق'}).length,1);
 assert.equal(selectNeighborhoodRows(parsed.records,{city:'وادي الدواسر',district:'العقيق'}).length,1);
});
test('Arabic digits and Arabic decimal separators accepted without changing scale',()=>{
 const parsed=parseResearchCsv('المدينة,الحي,عدد الإفراغات,إجمالي القيمة,متوسط سعر المتر سكني,النمو\nجدة,الصفا,٣,"١٬٢٣٤٬٥٦٧",١٨٠٠٫٥,١٢٫٥٪');
 assert.equal(parsed.records[0].residentialSarSqm,1800.5);
 assert.equal(parsed.records[0].totalValueSar,1234567);
 assert.equal(parsed.records[0].growthPct,12.5);
});
test('aggregates are never treated as executed-sale comparable or certified valuation',()=>{
 const r=sample[0];assert.equal(r.executedTransactionRecord,false);
 assert.equal(r.marketValuationEligible,false);
 assert.equal(researchSummary(sample).verifiedMarketComparables,0);
});
test('zero transfer count cannot be interpreted as zero property value',()=>{
 const r=sample.find(x=>x.city==='شقراء');
 assert.equal(r.transferCount,0);assert.equal(r.residentialSarSqm,305);
 assert.equal(r.marketValuationEligible,false);
});
test('location is mandatory on imported research',()=>{
 assert.throws(()=>parseResearchCsv('الحي,عدد الإفراغات\nالروضة,4'),/CITY_DISTRICT_REQUIRED/);
});
test('invalid aggregate is rejected without importing as an executed transaction',()=>{
 const r=parseResearchCsv('المدينة,الحي,عدد الإفراغات\nالخبر,العليا,-1\nالدمام,الفيصلية,2');
 assert.equal(r.records.length,1);assert.equal(r.rejected.length,1);
 assert.equal(r.records[0].executedTransactionRecord,false);
});
test('negative neighborhood growth is allowed, but negative deals and prices are blocked',()=>{
 const c=parseResearchCsv('المدينة,الحي,عدد الإفراغات,إجمالي القيمة,النمو\nجدة,الصفا,2,500000,-12.5\nالخبر,العليا,-1,100000,2\nالدمام,المريكبات,1,-99,2');
 assert.equal(c.records.length,1);
 assert.equal(c.records[0].growthPct,-12.5);
 assert.equal(c.rejected.length,2);
});
test('malformed imported csv rejects unclosed quoting',()=>{
 assert.throws(()=>parseResearchCsv('المدينة,الحي\n"الخبر,العليا'),/UNCLOSED_QUOTE/);
});
test('public sample does not pretend all 765 records were fetched',()=>{
 assert.equal(sample.length,10);
 assert.ok(!sample.some(x=>x.periodStart||x.periodEnd));
});
console.log('SUHAIL_NATIONAL_RESEARCH_TESTS='+n+'/'+n);

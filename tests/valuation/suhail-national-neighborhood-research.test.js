'use strict';
const assert=require('node:assert/strict');
const {toPublicSample,parseResearchCsv,mergeNeighborhoodResearch,selectNeighborhoodRows,researchSummary}=require('../../src/market/suhail-national-neighborhood-research');
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
test('numeric formatting never turns an ambiguous 1,2 value into 12',()=>{
 const csv='المدينة,الحي,عدد الإفراغات,إجمالي القيمة,النمو\nجدة,الصفا,"1,2",3000,2\nالدمام,الشاطئ,2,"1,234",2\nالخبر,الحزام,2,1٬234٫5,-5%';
 const r=parseResearchCsv(csv);
 assert.equal(r.rejected.length,1);
 assert.equal(r.records.length,2);
 assert.equal(r.records[0].totalValueSar,1234);
 assert.equal(r.records[1].totalValueSar,1234.5);
 assert.equal(r.records[1].growthPct,-5);
});
test('percent signs in sale values are not accepted as currencies',()=>{
 const r=parseResearchCsv('المدينة,الحي,إجمالي القيمة\nجدة,الفيصلية,100%');
 assert.equal(r.records.length,0);
 assert.equal(r.rejected.length,1);
});
test('merge keeps old cities, skips exact duplicates and flags conflicts',()=>{
 const incoming=parseResearchCsv('city,district,transferCount,totalValueSar\nJeddah,Al Safa,2,500000').records;
 const prior=toPublicSample();
 const joined=mergeNeighborhoodResearch(prior,incoming);
 assert.equal(joined.records.length,11);
 assert.equal(joined.added,1);
 assert.equal(researchSummary(joined.records).cityCount,7);
 const duplicate=mergeNeighborhoodResearch(joined.records,incoming);
 assert.equal(duplicate.records.length,11);
 assert.equal(duplicate.duplicates,1);
 const different=parseResearchCsv('city,district,transferCount,totalValueSar\nJeddah,Al Safa,3,500000').records;
 const conflict=mergeNeighborhoodResearch(joined.records,different);
 assert.equal(conflict.conflicts.length,1);
 assert.equal(conflict.records.length,11);
 assert.equal(conflict.records.at(-1).transferCount,2);
});
test('different observation date allows versioned neighborhood snapshots',()=>{
 const csv='city,district,transferCount\nJeddah,Al Safa,4';
 const a=parseResearchCsv(csv,{observedOn:'2026-10-27'}).records;
 const b=parseResearchCsv(csv,{observedOn:'2026-10-28'}).records;
 const m=mergeNeighborhoodResearch(a,b);
 assert.equal(m.records.length,2);
 assert.equal(m.conflicts.length,0);
});
test('invalid source, missing date and forged sale objects cannot enter merge',()=>{
 assert.throws(()=>parseResearchCsv('city,district\nJeddah,Al Safa',{
  sourceUrl:'https://user:pass@suhail.ai/transactions'}),/SOURCE_REQUIRED/);
 assert.throws(()=>parseResearchCsv('city,district\nJeddah,Al Safa',{
  observedOn:'2026-02-30'}),/OBSERVATION_DATE_INVALID/);
 assert.throws(()=>mergeNeighborhoodResearch([],[
  {...sample[0],executedTransactionRecord:true}]),/RECORD_INVALID/);
});
test('malformed imported csv rejects unclosed quoting',()=>{

 assert.throws(()=>parseResearchCsv('المدينة,الحي\n"الخبر,العليا'),/UNCLOSED_QUOTE/);
});
test('public sample does not pretend all 765 records were fetched',()=>{
 assert.equal(sample.length,10);
 assert.ok(!sample.some(x=>x.periodStart||x.periodEnd));
});
console.log('SUHAIL_NATIONAL_RESEARCH_TESTS='+n+'/'+n);

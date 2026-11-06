'use strict';
const assert=require('node:assert/strict');
const {FEATURES,BY_FEATURE,importEarthResearchCsv,mergeEarthResearch,
 filterEarthResearch,earthResearchSummary}=require('../../src/market/earth-national-research');
const asOf='2026-10-28';
let n=0;function check(label,run){run();n++;console.log('PASS '+label);}
const headers='المدينة,الحي,رقم الصفقة,تاريخ الصفقة,قيمة الصفقة,المساحة,رقم المخطط,رقم القطعة';
const csv=(...rows)=>[headers,...rows].join('\n');
const sale='الرياض,الملقا,TX-101,2026-10-23,5000000,1000,123,456';
const rent='جدة,السلامة,LEASE-2,2026-10-22,120000,180,88,5';
const parse=(featureId,body,options={})=>importEarthResearchCsv(body,{
 featureId,observedOn:asOf,asOf:new Date('2026-10-28T23:00:00Z'),...options});
check('ten exact Earth site features preserve distinct research contexts',()=>{
 assert.equal(FEATURES.length,10);assert.equal(Object.keys(BY_FEATURE).length,10);
 assert.ok(FEATURES.every(x=>x.url.startsWith('https://')&&x.kind));
 assert.equal(new Set(FEATURES.map(x=>x.id)).size,10);
});
check('sales table is third-party reported not automatically verified executed',()=>{
 const r=parse('TRANSACTION_TABLE',csv(sale));
 assert.equal(r.records.length,1);assert.equal(r.records[0].amountSar,5000000);
 assert.equal(r.records[0].evidenceKind,'REPORTED_SALE');
 assert.equal(r.records[0].executedTransactionRecord,false);
 assert.equal(r.records[0].transactionIndependentlyVerified,false);
 assert.equal(r.records[0].marketValuationEligible,false);
});
check('rental deals differ categorically from executed sale comparables',()=>{
 const r=parse('RENTAL_DEALS',csv(rent));
 assert.equal(r.records[0].evidenceKind,'REPORTED_RENT');
 assert.equal(r.records[0].marketValuationEligible,false);
});
check('registry view cannot grant ownership verification',()=>{
 const r=parse('REAL_ESTATE_REGISTER',csv(sale));
 assert.equal(r.records[0].officialRegistryVerified,false);
 assert.equal(r.records[0].professionalReportAuthorized,false);
});
check('valuation indications cannot feed certified valuation',()=>{
 const r=parse('VALUE_ESTIMATE',csv(sale));
 assert.equal(r.records[0].evidenceKind,'VALUE_INDICATION');
 assert.equal(r.records[0].marketValuationEligible,false);
});
check('invalid date and ambiguous Arabic number are rejected',()=>{
 const bad=csv(sale.replace('5000000','"1,2"'),sale.replace('2026-10-23','2026-02-30'));
 const r=parse('TRANSACTION_TABLE',bad);
 assert.equal(r.records.length,0);assert.equal(r.rejected.length,2);
});
check('Arabic and western grouping work without silent numeric inflation',()=>{
 const line=sale.replace('5000000','"٥٬٠٠٠٬٠٠٠"').replace('1000','١٠٠٠٫٥');
 const r=parse('TRANSACTION_TABLE',csv(line));
 assert.equal(r.records[0].amountSar,5000000);assert.equal(r.records[0].areaSqm,1000.5);
});
check('same third-party transaction ID cannot overwrite conflicting record in same batch date',()=>{
 const a=parse('TRANSACTION_TABLE',csv(sale)).records;
 const b=parse('TRANSACTION_TABLE',csv(sale.replace('5000000','6000000'))).records;
 const m=mergeEarthResearch(a,b);
 assert.equal(m.conflicts.length,1);assert.equal(m.records[0].amountSar,5000000);
});
check('repeat import is idempotent, and a new observation date creates new snapshot',()=>{
 const a=parse('TRANSACTION_TABLE',csv(sale)).records;
 const b=parse('TRANSACTION_TABLE',csv(sale),{observedOn:'2026-10-27'}).records;
 const m=mergeEarthResearch(a,a);assert.equal(m.duplicates,1);assert.equal(m.records.length,1);
 const next=mergeEarthResearch(a,b);assert.equal(next.records.length,2);
});
check('Saudi city filter retains location and source kind',()=>{
 const a=parse('TRANSACTION_TABLE',csv(sale)).records;
 const b=parse('RENTAL_DEALS',csv(rent)).records;
 const combined=mergeEarthResearch(a,b).records;
 assert.equal(filterEarthResearch(combined,{city:'جدة'}).length,1);
 assert.equal(filterEarthResearch(combined,{featureId:'TRANSACTION_TABLE'}).length,1);
 assert.equal(earthResearchSummary(combined).cities.length,2);
});
check('no cross-feature records can be imported under wrong source selection',()=>{
 const body='city,district,featureId,recordId\nRiyadh,Malqa,RENTAL_DEALS,SYN-1';
 const r=parse('TRANSACTION_TABLE',body);
 assert.equal(r.records.length,0);assert.equal(r.rejected.length,1);
});
check('Earth published city/district combined export headers are supported conservatively',()=>{
 const csv='المدينة/الحي,الرقم المرجعي للصفقة,التاريخ,سعر الصفقة,المساحة\\nالرياض / الملقا,TX-200,2026-10-22,5500000,1000';
 const r=parse('TRANSACTION_TABLE',csv.replace('\\n','\n'));
 assert.equal(r.records.length,1);
 assert.equal(r.records[0].city,'الرياض');assert.equal(r.records[0].district,'الملقا');
 assert.equal(r.records[0].recordId,'TX-200');
});
check('contradictory city metadata in a combined Earth export is rejected',()=>{
 const csv='المدينة,المدينة/الحي,رقم الصفقة\\nجدة,الرياض / الملقا,TX-3';
 const r=parse('TRANSACTION_TABLE',csv.replace('\\n','\n'));
 assert.equal(r.records.length,0);
 assert.ok(r.rejected[0].issues.includes('COMBINED_CITY_DISTRICT_CONFLICT'));
});
check('unknown feature or future date is invalid',()=>{
 assert.throws(()=>parse('NOT_REAL',csv(sale)),/FEATURE_NOT_SUPPORTED/);
 assert.throws(()=>parse('TRANSACTION_TABLE',csv(sale),{observedOn:'2026-10-29'}),/OBSERVED_DATE_INVALID/);
});
check('national Earth catalog has no independent title, price or transactions certified',()=>{
 const r=parse('TRANSACTION_TABLE',csv(sale));
 assert.equal(r.independentExecutedSales,0);
 assert.equal(r.autoValuationEnabled,false);
 assert.equal(r.records[0].professionalReportAuthorized,false);
});
console.log('EARTH_SAUDI_NATIONAL_RESEARCH='+n+'/'+n);

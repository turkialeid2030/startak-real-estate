'use strict';
const assert=require('node:assert/strict');
const {
 OPEN_QUARTERS,parseQuarter,deriveDistrictSnapshot,readOpenQuarters,
 isoDate,splitCsv,
}=require('../../src/market/saudi-open-data-research');
const asOf=new Date('2026-10-27T12:00:00Z');
const csv=[
 '\uFEFFالمنطقة,المدينة,المدينة / الحي,الرقم المرجعي للصفقة,تاريخ الصفقة ميلادي,تصنيف العقار,عدد العقارات,السعر,المساحة',
 'منطقة الرياض,الرياض,الرياض/الملقا,76001,2026/02/15,سكني,1,"1,800,000",600',
 'منطقة الرياض,الرياض,الرياض/الملقا,76002,2026/02/16,سكني,1,"2,000,000",500',
 'منطقة الرياض,الرياض,الرياض/الملقا,76003,2026/02/18,سكني,1,"3,000,000",600',
 'منطقة الرياض,الرياض,الرياض/الملقا,76003,2026/02/18,سكني,1,"3,000,000",600',
 'منطقة الرياض,الرياض,الرياض/الندى,77001,2026/02/19,سكني,1,"6,000,000",600',
 'منطقة مكة المكرمة,جدة,جدة/الصفا,78001,2026/02/20,تجاري,1,"4,000,000",200',
 'منطقة مكة المكرمة,مكة المكرمة,مكة المكرمة/العزيزية,79001,2026/02/20,سكني,1,"6,000,000",600',
 'المنطقة الشرقية,الخبر,الخبر/العقربية,80001,2026/02/20,سكني,1,"6,000,000",600',
 'منطقة الرياض,الرياض,الرياض/الملقا,90000,2028/02/20,سكني,1,"6,000,000",600',
 'منطقة الرياض,الرياض,الرياض/الملقا,91000,2026/02/20,سكني,1,0,600',
 ].join('\r\n');
assert.deepEqual(splitCsv('a,"one,two",c'),['a','one,two','c']);
assert.equal(isoDate('2026/2/5'),'2026-02-05');
assert.equal(isoDate('2026/13/1'),null);
const data=parseQuarter(csv,{quarter:'2026-Q1',asOf});
assert.equal(data.records.length,8,'future and invalid prices excluded');
assert.equal(data.excludedInvalid,2);
const sample=data.records.find(x=>x.reference==='76001');
assert.equal(sample.city,'الرياض');
assert.equal(sample.district,'الملقا');
assert.equal(sample.price,1800000);
assert.equal(sample.priceSqm,3000);
assert.equal(sample.propertyType,'');
assert.equal(sample.subtypeVerified,false);
// An open data mirror is not trusted just because its CSV is machine readable.
// Strict grouping is mandatory for correct money, area and unit prices.
const badCsv=[
 'المدينة,المدينة / الحي,تاريخ الصفقة ميلادي,الرقم المرجعي للصفقة,السعر,المساحة',
 'الرياض,الرياض/الملقا,2026/02/15,BAD-COMMA,"1,2",600',
 'الرياض,الرياض/الملقا,2026/02/16,BAD-SPACE,1 2,600',
 'الرياض,الرياض/الملقا,2026/02/17,BAD-AREA,1800000,"6,0"',
 'الرياض,الرياض/الملقا,2026/02/18,GOOD-ARABIC,"١٬٨٠٠٬٠٠٠",٦٠٠',
].join('\n');
const bounded=parseQuarter(badCsv,{quarter:'2026-Q1',asOf});
assert.equal(bounded.records.length,1);
assert.equal(bounded.excludedInvalid,3);
assert.equal(bounded.records[0].reference,'GOOD-ARABIC');
assert.equal(bounded.records[0].price,1800000);
assert.equal(bounded.records[0].area,600);

const result=deriveDistrictSnapshot(data.records,{city:'الرياض',district:'الملقا',classification:'سكني',asOf});
assert.equal(result.count,3,'deduplicate registration id');
assert.equal(result.medianPriceSqm,4000);
assert.equal(result.status,'HISTORIC_NEIGHBORHOOD_CONTEXT');
assert.equal(result.subtypeSuitableForSubject,false);
assert.equal(result.marketValueCertified,false);
assert.equal(deriveDistrictSnapshot(data.records,{city:'جدة',district:'الصفا',classification:'تجاري',asOf}).count,1);
assert.equal(deriveDistrictSnapshot(data.records,{city:'مكة المكرمة',district:'العزيزية',asOf}).count,1);
assert.equal(deriveDistrictSnapshot(data.records,{city:'الخبر',district:'العقربية',asOf}).count,1);
assert.equal(deriveDistrictSnapshot(data.records,{city:'الرياض',district:'',asOf}).status,'LOCATION_REQUIRED');
const calls=[];
const fakeFetch=async(url)=>{calls.push(url);return {ok:true,headers:{get:()=>null},text:async()=>csv};};
readOpenQuarters({fetchImpl:fakeFetch,quarters:['2026-Q1'],asOf}).then(snapshot=>{
 assert.equal(snapshot.records.length,8);
 assert.equal(snapshot.sources.length,1);
 assert.equal(snapshot.errors.length,0);
 assert.equal(snapshot.incomplete,false);
 assert.equal(snapshot.noLicensedRealTimeFeed,true);
 assert.equal(snapshot.notParcelComps,true);
 assert.equal(calls[0].includes('civillizard'),true);
 return readOpenQuarters({fetchImpl:async()=>{throw Error('CORS_DENIED');},quarters:['2026-Q1'],asOf});
}).then(snapshot=>{
 assert.equal(snapshot.incomplete,true);
 assert.equal(snapshot.sources.length,0);
 assert.equal(snapshot.errors[0].code,'CORS_DENIED');
 assert.equal(OPEN_QUARTERS.length,3);
 console.log('OPEN_LICENSED_MOJ_DATA_RESEARCH: PASS');
}).catch(error=>{console.error(error);process.exitCode=1;});

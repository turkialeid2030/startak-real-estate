'use strict';
const assert=require('node:assert/strict');
const {SOURCES,importNationalSourcesCsv,mergeNationalResearch,
 filterNationalResearch,summarizeNationalResearch}=require('../../src/market/saudi-national-intelligence-sources');
let n=0;function test(name,fn){fn();n++;console.log('PASS '+name);}
const observedOn='2026-10-28';
const fields=['source','city','district','kind','recordId','eventDate','periodStart','periodEnd',
 'metricName','metricValue','unit','sourceUrl','assetType'];
const lines=[
 ['REGA_REI','الرياض','الملقا','OFFICIAL_AGGREGATE','','','2026-07-01','2026-09-30',
 'deal_count','250','COUNT','https://rei.rega.gov.sa/ar','LAND'],
 ['MOJ_SREM','الرياض','الملقا','OFFICIAL_REPORTED_SALE','SYN-01','2026-10-22','','',
 'sale_price_sar','5000000','SAR','https://srem.moj.gov.sa/','LAND'],
 ['MOJ_REPORTS','الخبر','العليا','OFFICIAL_AGGREGATE','','','2026-01-01','2026-03-31',
 'deal_value_sar','7000000','SAR',
 'https://www.moj.gov.sa/ar/OpenData/PowerBIReport/Pages/default.aspx','LAND'],
 ['PASEETAH','جدة','السلامة','THIRD_PARTY_AGGREGATE','','','2026-07-01','2026-09-30',
 'avg_sqm_sar','2500','SAR_PER_SQM','https://paseetah.com/','LAND'],
 ['GREM_AI','جدة','السلامة','EXTERNAL_AVM_ESTIMATE','SYN-AVM-1','','','',
 'estimated_value_sar','900000','SAR','https://ai.grem.capital/ar','APARTMENT'],
 ['TATHMIN','الدمام','الشاطئ','RESEARCH_NOTE','','','','',
 '','','','https://tathmin.online/valuation',''],
 ['EHSIBHA','الدمام','الشاطئ','RESEARCH_NOTE','','','','',
 '','','','https://ehsibha.sa/ive',''],
 ['ART_OF_VALUE','الرياض','الصحافة','RESEARCH_NOTE','','','','',
 '','','','https://artofvalue.sa/',''],
 ['THREE_QAR_AI','جدة','الروضة','RESEARCH_NOTE','','','','',
 '','','','https://3qar.ai/',''],
 ['BAYUT_TRUVALUE','مكة المكرمة','العوالي','EXTERNAL_AVM_ESTIMATE','SYN-BAYUT-1','','','',
 'estimated_value_sar','1800000','SAR','https://www.bayut.sa/property-market-analysis/tru-value/','APARTMENT'],
 ['MANUS_SHARE','الدمام','الشاطئ','RESEARCH_NOTE','','','','',
 '','','','https://manus.im/share/QnCMa3VxXUKQoW2SNmj98H',''],
];
const csv=rows=>[fields.join(','),...rows.map(x=>x.join(','))].join('\n');
const parse=rows=>importNationalSourcesCsv(csv(rows),{observedOn,asOf:new Date('2026-10-28T20:00:00Z')});
const baseline=parse(lines);
test('eleven references include Bayut TruValue and unreadable Manus session',()=>{
 assert.equal(SOURCES.length,11);assert.equal(baseline.records.length,11);assert.equal(baseline.rejected.length,0);
 assert.equal(new Set(baseline.records.map(x=>x.sourceId)).size,11);
});
test('official provenance alone never authorizes a certified executed sale',()=>{
 assert.ok(baseline.records.every(x=>x.executedTransactionRecord===false&&
  x.marketValuationEligible===false&&x.sourceRecordAuthenticated===false));
 assert.equal(baseline.independentVerifiedExecutedSales,0);
});
test('nonofficial estimators are not classified as official transactions',()=>{
 const r=baseline.records.find(x=>x.sourceId==='GREM_AI');
 assert.equal(r.evidenceClass,'EXTERNAL_AVM_ESTIMATE');assert.equal(r.metricValue,900000);
 assert.equal(r.professionalReportAuthorized,false);
});
test('dynamic-only and reference websites cannot inject fake prices',()=>{
 const invalid=lines[5].slice();
 invalid[9]='500000';invalid[8]='estimated_value_sar';invalid[10]='SAR';
 const r=parse([invalid]);
 assert.equal(r.records.length,0);
 assert.equal(r.rejected.length,1);
});
test('reported sale requires source transaction reference and event date',()=>{
 const invalid=lines[1].slice();invalid[4]='';
 const r=parse([invalid]);assert.equal(r.records.length,0);
 assert.ok(r.rejected[0].issues.includes('TRANSACTION_REPORTED_REFERENCE_DATE_REQUIRED'));
});
test('aggregate needs a comparable period and explicit metric unit',()=>{
 const invalid=lines[0].slice();invalid[6]='';
 const r=parse([invalid]);assert.equal(r.records.length,0);
 assert.ok(r.rejected[0].issues.includes('AGGREGATE_PERIOD_REQUIRED'));
});
test('regional research is isolated by actual city and source',()=>{
 assert.equal(filterNationalResearch(baseline.records,{city:'الرياض'}).length,3);
 assert.equal(filterNationalResearch(baseline.records,{sourceId:'PASEETAH',city:'جدة'}).length,1);
 assert.equal(summarizeNationalResearch(baseline.records).verifiedExecutedSales,0);
});
test('strict numbers do not turn 1,2 into 12 or accept percentage as currency',()=>{
 const bad=lines[1].slice();bad[9]='"1,2"';
 assert.equal(parse([bad]).rejected.length,1);
 const pct=lines[1].slice();pct[9]='98%';
 assert.equal(parse([pct]).rejected.length,1);
 const ar=lines[1].slice();ar[9]='٥٠٠٠٫٥';
 assert.equal(parse([ar]).records[0].metricValue,5000.5);
});
test('lookalike domain or credentials are rejected',()=>{
 const a=lines[0].slice();a[11]='https://rei.rega.gov.sa.evil.net/ar';
 const b=lines[0].slice();b[11]='https://user:pass@rei.rega.gov.sa/ar';
 assert.equal(parse([a,b]).rejected.length,2);
});
test('same source/period observation conflicts are not silently overwritten',()=>{
 const orig=parse([lines[0]]).records;
 const changed=lines[0].slice();changed[9]='255';
 const m=mergeNationalResearch(orig,parse([changed]).records);
 assert.equal(m.records.length,1);assert.equal(m.conflicts.length,1);
 assert.equal(m.records[0].metricValue,250);
});
test('duplicate imports are idempotent and different observed day preserved',()=>{
 const first=parse([lines[0]]).records;
 const dup=mergeNationalResearch(first,first);
 assert.equal(dup.duplicates,1);
 const other=importNationalSourcesCsv(csv([lines[0]]),{
  observedOn:'2026-10-27',asOf:new Date('2026-10-28T10:00:00Z')});
 const m=mergeNationalResearch(first,other.records);
 assert.equal(m.records.length,2);
});
test('unsupported source-metric pair is blocked',()=>{
 const invalid=lines[0].slice();invalid[3]='EXTERNAL_AVM_ESTIMATE';invalid[8]='estimated_value_sar';
 const result=parse([invalid]);assert.equal(result.rejected.length,1);
});
test('no row imports unexpected seller or customer PII columns',()=>{
 const extra=[...fields,'رقم الجوال'];
 const csv2=[extra.join(','),[...lines[0],'0509999999'].join(',')].join('\n');
 const records=importNationalSourcesCsv(csv2,{observedOn}).records;
 assert.equal(records.length,1);
 assert.ok(!JSON.stringify(records[0]).includes('0509999999'));
});
test('TruValue point, provider-supplied confidence and interval remain advisory',()=>{
 const cols=[...fields,'rangeLowSar','rangeHighSar','confidenceLabel','modelAsOf'];
 const record=[...lines[9],'1700000','1900000','HIGH','2026-10-27'];
 const x=importNationalSourcesCsv([cols.join(','),record.join(',')].join('\n'),{observedOn});
 assert.equal(x.records.length,1);
 const r=x.records[0];
 assert.equal(r.providerRangeLowSar,1700000);
 assert.equal(r.providerRangeHighSar,1900000);
 assert.equal(r.providerStatedConfidence,'HIGH');
 assert.equal(r.executedTransactionRecord,false);
 assert.equal(r.marketValuationEligible,false);
});
test('TruValue asset types and invalid estimation ranges are blocked',()=>{
 const cols=[...fields,'rangeLowSar','rangeHighSar'];
 const parseOne=v=>importNationalSourcesCsv([cols.join(','),v.join(',')].join('\n'),{observedOn});
 assert.equal(parseOne([...lines[9],'1700000','']).records.length,0);
 assert.equal(parseOne([...lines[9],'2100000','2300000']).records.length,0);
 const hotel=lines[9].slice();hotel[12]='HOTEL';
 assert.equal(parseOne([...hotel,'1700000','1900000']).records.length,0);
});
test('Manus share is not a verified input capable of bearing prices',()=>{
 const fake=lines[10].slice();fake[3]='EXTERNAL_AVM_ESTIMATE';fake[4]='FAKE-123';
 fake[8]='estimated_value_sar';fake[9]='1000000';fake[10]='SAR';
 assert.equal(parse([fake]).records.length,0);
 assert.ok(parse([fake]).rejected[0].issues.includes('KIND_NOT_ALLOWED_FOR_SOURCE'));
});
test('official sales cannot carry uncalibrated provider confidence',()=>{
 const cols=[...fields,'confidenceLabel'];
 const r=importNationalSourcesCsv([cols.join(','),[...lines[1],'HIGH'].join(',')].join('\n'),{observedOn});
 assert.equal(r.records.length,0);
 assert.ok(r.rejected[0].issues.includes('AVM_METADATA_NOT_ALLOWED'));
});
console.log('NATIONAL_ELEVEN_SOURCE_RESEARCH_TESTS='+n+'/'+n);

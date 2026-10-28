'use strict';
const assert=require('node:assert/strict');
const {SOURCES,SOURCE_MAP,parseListingResearchCsv,mergeListingResearch,
 filterListingResearch,listingResearchSummary}=require('../../src/market/saudi-listing-source-research');
let n=0;function check(label,fn){fn();n++;console.log('PASS '+label);}
const observedOn='2026-10-28';
const header='source,city,district,kind,priceSar,areaSqm,listingUrl,listingId,assetType,listingDate';
const rows=[
 'عقار,الرياض,الملقا,SALE_OFFER,1500000,300,https://sa.aqar.fm/p/100,AQ-100,RESIDENTIAL_VILLA,2026-10-26',
 'حراج,الرياض,العارض,SALE_OFFER,1900000,400,https://haraj.com.sa/offer/202,H-202,LAND,2026-10-20',
 'بيوت السعودية,جدة,السلامة,RENT_OFFER,72000,100,https://www.bayut.sa/offer/202,B-202,RESIDENTIAL_BUILDING,2026-10-18',
 'بروبرتي فايندر,الخبر,العليا,SALE_OFFER,2500000,500,https://www.propertyfinder.sa/p/22,PF-22,RESIDENTIAL_VILLA,2026-10-14',
 'وصلت,الدمام,الشاطئ,AUCTION_ASK,2100000,700,https://wasalt.sa/ar/auction/33,W-33,LAND,2026-10-22',
 'سكني,المدينة المنورة,شظاة,PROJECT_INDICATIVE,750000,160,https://sakani.sa/services/off-plan-projects,S-50,RESIDENTIAL_VILLA,2026-10-27',
 'ديل,أبها,المنسك,BUYER_REQUEST,1400000,350,https://dealapp.sa/ar/tabs/home,D-12,RESIDENTIAL_VILLA,2026-10-25',
];
const parse=(data,params={})=>parseListingResearchCsv(data,{observedOn,...params});
const importAll=parse([header,...rows].join('\n'));
check('seven official sources are configured with their real distinct roles',()=>{
 assert.equal(SOURCES.length,7);
 assert.deepEqual(importAll.records.map(x=>x.sourceId),
  ['AQAR','HARAJ','BAYUT','PROPERTY_FINDER','WASALT','SAKANI','DEAL']);
 assert.equal(importAll.rejected.length,0);
});
check('requests, auction bids and projects never become executed sales',()=>{
 assert.ok(importAll.records.every(x=>x.executedTransactionRecord===false&&
   x.marketValuationEligible===false&&x.professionalReportAuthorized===false));
 assert.equal(importAll.records.at(-1).kind,'BUYER_REQUEST');
 assert.equal(importAll.records.at(-2).kind,'PROJECT_INDICATIVE');
 assert.equal(importAll.records.at(-3).kind,'AUCTION_ASK');
 assert.equal(importAll.importedIndividualExecutedTransactions,0);
});
check('Saudi-wide filtering preserves city and source specificity',()=>{
 assert.equal(filterListingResearch(importAll.records,{city:'الرياض'}).length,2);
 assert.equal(filterListingResearch(importAll.records,{city:'جدة',sourceId:'BAYUT'}).length,1);
 assert.equal(filterListingResearch(importAll.records,{sourceId:'DEAL',kind:'BUYER_REQUEST'}).length,1);
 assert.equal(listingResearchSummary(importAll.records).cities.length,6);
});
check('disallow fake platform URLs including lookalike domains and credentials',()=>{
 const fake=rows[0].replace('https://sa.aqar.fm/p/100','https://sa.aqar.fm.evil.com/p/100');
 const pass=rows[0].replace('https://sa.aqar.fm/p/100','https://user:pass@sa.aqar.fm/p/100');
 assert.equal(parse([header,fake,pass].join('\n')).records.length,0);
 assert.equal(parse([header,fake,pass].join('\n')).rejected.length,2);
});
check('strict Arabic decimal and grouping never converts ambiguous 1,2 into 12',()=>{
 const good=rows[0].replace('1500000','١٥٠٠٫٥').replace('300','٣٠٠');
 const bad=rows[0].replace('1500000','"1,2"');
 assert.equal(parse([header,good].join('\n')).records[0].askingPriceOrBudgetSar,1500.5);
 assert.equal(parse([header,bad].join('\n')).records.length,0);
});
check('impossible dates and future observation are rejected',()=>{
 assert.throws(()=>parse([header,rows[0]].join('\n'),{observedOn:'2026-10-29'}),/OBSERVATION_INVALID/);
 const invalid=rows[0].replace('2026-10-26','2026-02-30');
 assert.equal(parse([header,invalid].join('\n')).rejected.length,1);
});
check('reject explicit executed transactions in listing-source research',()=>{
 const invalid=rows[0].replace(',SALE_OFFER,',',EXECUTED,');
 assert.equal(parse([header,invalid].join('\n')).records.length,0);
});
check('do not silently overwrite same URL same observed date with conflicting prices',()=>{
 const old=parse([header,rows[0]].join('\n')).records;
 const newRows=parse([header,rows[0].replace('1500000','1600000')].join('\n')).records;
 const merged=mergeListingResearch(old,newRows);
 assert.equal(merged.conflicts.length,1);assert.equal(merged.records.length,1);
 assert.equal(merged.records[0].askingPriceOrBudgetSar,1500000);
});
check('distinct request IDs at a generic Deal page cannot overwrite one another',()=>{
 const a=rows.at(-1);
 const b=rows.at(-1).replace('D-12','D-13').replace('1400000','1500000');
 const imported=parse([header,a,b].join('\n'));
 assert.equal(imported.records.length,2);
 const m=mergeListingResearch([],imported.records);
 assert.equal(m.records.length,2);assert.equal(m.conflicts.length,0);
});
check('generic public root with neither specific URL nor listing reference is rejected',()=>{
 const entry=rows[0].replace('https://sa.aqar.fm/p/100,AQ-100','https://sa.aqar.fm/,');
 const parsed=parse([header,entry].join('\n'));
 assert.equal(parsed.rejected.length,1);
 assert.ok(parsed.rejected[0].issues.includes('SPECIFIC_LISTING_REFERENCE_REQUIRED'));
});
check('same advertisement in later observation date remains a new version',()=>{
 const old=parse([header,rows[0]].join('\n'),{observedOn:'2026-10-27'}).records;
 const next=parse([header,rows[0]].join('\n')).records;
 const joined=mergeListingResearch(old,next);
 assert.equal(joined.records.length,2);assert.equal(joined.added,1);
});
check('exact reimport is idempotent and source totals are retained',()=>{
 const duplicate=mergeListingResearch(importAll.records,importAll.records);
 assert.equal(duplicate.duplicates,7);assert.equal(duplicate.records.length,7);
 assert.equal(duplicate.added,0);assert.equal(duplicate.executedTransactions,0);
});
check('equal attributes on different platforms are only possible duplicate flags',()=>{
 const first=rows[0];
 const other=rows[0].replace('عقار,','حراج,').replace('https://sa.aqar.fm/p/100','https://haraj.com.sa/p/100');
 const mixed=parse([header,first,other].join('\n')).records;
 const m=mergeListingResearch([],mixed);
 assert.equal(m.records.length,2);
 assert.equal(m.potentialCrossSourceDuplicates.length,1);
});
check('buyer demand is not accepted on a marketplace without buyer-request capability',()=>{
 const wrong=rows.at(-1).replace('ديل,','بيوت السعودية,').replace('https://dealapp.sa/ar/tabs/home','https://www.bayut.sa/a/1');
 assert.equal(parse([header,wrong].join('\n')).rejected.length,1);
});
check('keep unknown seller contact fields out of research model',()=>{
 const a=[header+',رقم الجوال',rows[0]+',0501234567'].join('\n');
 const result=parse(a);
 assert.equal(result.records.length,1);
 assert.ok(!('رقم الجوال' in result.records[0]));
 assert.ok(!Object.values(result.records[0]).includes('0501234567'));
});
check('missing source, invalid area and duplicate headers are rejected',()=>{
 const bad=rows[0].replace('عقار,','UNKNOWN,').replace(',300,',',-1,');
 assert.equal(parse([header,bad].join('\n')).rejected.length,1);
 assert.throws(()=>parse(['source,source,city,district,kind', 'AQAR,AQAR,Jeddah,A,SALE_OFFER'].join('\n')),
  /DUPLICATE_HEADERS/);
});
console.log('SAUDI_LISTING_SOURCE_RESEARCH='+n+'/'+n);

'use strict';
const assert=require('node:assert/strict');
const {rowsFromCsv,prepareImportCsv}=require('../../src/market/public-dataset-import');
const {evaluateMarketStudy}=require('../../src/market/instant-market-study');
assert.throws(()=>prepareImportCsv('x,y\n1,2',{kind:'sale',datasetUrl:'https://data.gov.sa/x'}),/DATASET_RIGHTS_NOT_CONFIRMED/);
const content=[
  'نوع العقار,حالة الصفقة,تاريخ الصفقة,قيمة الصفقة,المساحة المبنية,المدينة,الحي,رقم الصفقة',
  'مجمع سكني,إفراغ,2026-10-01,"120,000,000",20000,الرياض,الملقا,S001',
  'مجمع سكني,إفراغ,2026-10-01,"126,000,000",20000,الرياض,الملقا,S002',
  'مجمع سكني,إفراغ,2026-10-01,"114,000,000",20000,الرياض,الملقا,S003',
  'مجمع سكني,عرض,2026-10-02,"300,000,000",20000,الرياض,الملقا,S004',
].join('\n');
const imported=prepareImportCsv(content,{kind:'sale',datasetUrl:'https://data.gov.sa/datasets/example',rightsConfirmed:true});
assert.equal(imported.rows.length,4);assert.equal(imported.rows[0].assetType,'RESIDENTIAL_COMPOUND');
assert.equal(imported.rows[0].price,'120,000,000');assert.equal(imported.rows[0].status,'EXECUTED');
assert.equal(imported.rows[3].status,'ASKING');
const subject={
  assetType:'RESIDENTIAL_COMPOUND',city:'الرياض',district:'الملقا',location:'24.75000,46.65000',
  builtArea:'30000',rentableArea:'25000',buildingCount:'5',unitCount:'200',
  leaseHistory:'UNKNOWN',urbanBoundary:'UNKNOWN',
};
const x=evaluateMarketStudy({subject,sales:imported.rows,asOf:new Date('2026-10-27T12:00:00Z')});
assert.equal(x.eligibleSalesCount,3);
assert.equal(x.districtOnlySalesCount,3);
assert.equal(x.saleIndicationSar,180000000);
assert.equal(x.todayValueScenarioSar,180000000);
assert.equal(x.hasLiveLicensedFeed,false);
assert.equal(x.independentlyVerified,false);
const mismatch=evaluateMarketStudy({subject:{...subject,district:'الياسمين'},sales:imported.rows,asOf:new Date('2026-10-27T12:00:00Z')});
assert.equal(mismatch.todayValueScenarioSar,null);
const duplicates=evaluateMarketStudy({subject,sales:[...imported.rows,imported.rows[0]],asOf:new Date('2026-10-27T12:00:00Z')});
assert.equal(duplicates.eligibleSalesCount,3);
const distant=evaluateMarketStudy({subject,sales:imported.rows.slice(0,3).map(x=>({...x,location:'25.77,46.55'})),asOf:new Date('2026-10-27T12:00:00Z')});
assert.equal(distant.eligibleSalesCount,0,'real but distant coordinates override matching district');
const falseExecuted=prepareImportCsv('نوع العقار,تاريخ الصفقة,قيمة الصفقة,المساحة المبنية,المدينة,الحي\nمجمع سكني,2026-10-01,10000,20,الرياض,الملقا',
{kind:'sale',datasetUrl:'https://data.gov.sa/data',rightsConfirmed:true});
assert.equal(falseExecuted.rows[0].status,'ASKING','missing status cannot infer executed');
assert.throws(()=>rowsFromCsv('a,b\n"oops'),/CSV_UNCLOSED_QUOTE/);
assert.equal(rowsFromCsv('a;b\n1;2').records[0].columns.b,'2');
assert.equal(rowsFromCsv('a,b\n"hello, there",x').records[0].columns.a,'hello, there');
const landCsv=[
 'نوع العقار,نوع الأرض,حالة الصفقة,تاريخ الصفقة,قيمة الصفقة,مساحة الأرض,المدينة,الحي,رقم الصفقة',
 'أرض,أرض خام,إفراغ,2026-10-01,10000000,12000,الرياض,الملقا,RAW-1',
 'أرض,أرض مخدومة,إفراغ,2026-10-01,12000000,12000,الرياض,الملقا,SERV-1',
].join('\n');
const importedLand=prepareImportCsv(landCsv,{kind:'sale',datasetUrl:'https://data.gov.sa/land',rightsConfirmed:true});
assert.equal(importedLand.rows[0].landSubtype,'RAW');
assert.equal(importedLand.rows[1].landSubtype,'SERVICED');
const asset={
  ...subject,assetType:'LAND',landSubtype:'RAW',landArea:'15000'
};
const selected=evaluateMarketStudy({subject:asset,sales:importedLand.rows,asOf:new Date('2026-10-27T12:00:00Z')});
assert.equal(selected.eligibleSalesCount,1,'serviced land cannot be valued as raw undeveloped land');
const sectorCsv=['نوع العقار,حالة الصفقة,تاريخ الصفقة,قيمة الصفقة,المساحة المبنية',
 'فندق,إفراغ,2026-10-01,100000000,25000',
 'مصنع,إفراغ,2026-10-01,20000000,9000',
 'مستشفى,إفراغ,2026-10-01,130000000,12000',
 'مول,إفراغ,2026-10-01,150000000,40000'].join('\n');
const sectors=prepareImportCsv(sectorCsv,{kind:'sale',datasetUrl:'https://data.gov.sa/sectors',rightsConfirmed:true});
assert.deepEqual(sectors.rows.map(x=>x.assetType),['HOTEL','INDUSTRIAL_PROPERTY','HEALTHCARE_PROPERTY','COMMERCIAL_MALL']);
console.log('STARTAK public dataset CSV local import: PASS');

'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {reviewLocalSaudiSaleCsv,parseDelimited,parseAmount,MAX_CSV_BYTES}=require('../../src/source-intelligence/personal-saudi-sale-csv');
const {PROVIDERS}=require('../../src/source-intelligence/personal-saudi-sale-csv');
const base={sourceProvider:'MINISTRY_OF_JUSTICE_REAL_ESTATE_TRANSACTIONS',
  sourceUrl:PROVIDERS.MINISTRY_OF_JUSTICE_REAL_ESTATE_TRANSACTIONS,asOf:'2026-10-25'};
const head='date,city_ar,property_type,price_sar,area_sqm,properties_count,ref_no,price_per_sqm';
const samples=[
 '2026-09-01,الرياض,أرض,"1,800,000",600,1,001,3000',
 '2026-09-03,الرياض,أرض,2100000,700,1,002,3000',
 '2026-09-07,الرياض,أرض,2400000,800,1,003,3000',
 '2026-09-03,الرياض,شقة,650000,100,1,004,6500',
 '2026-09-08,جدة,أرض,1200000,500,2,005,2400',
];
let checks=0;
function ok(x,y){assert.deepEqual(x,y);checks++;}
const file=[head,...samples].join('\r\n')+'\r\n';
const r=reviewLocalSaudiSaleCsv({...base,csvText:file});
ok(r.reason,'RESEARCH_ONLY_UNVERIFIED_EXPORT');
ok(r.rowsAccepted,4); // Jeddah has 2 properties, excluded.
ok(r.rowsExcluded,1);
ok(r.reasons.MULTI_PROPERTY_OR_UNDECLARED_COUNT,1);
ok(r.groups.find(g=>g.city==='الرياض'&&g.subtype==='أرض').medianPricePerSqm,3000);
ok(r.groups.find(g=>g.city==='الرياض'&&g.subtype==='شقة').medianPricePerSqm,null);
ok(r.sourceTransactionAuthenticityVerified,false);
ok(r.sourceLicenseIndependentlyVerified,false);
ok(r.independentMarketAccuracyVerified,false);
ok(r.transactionAuthorized,false);
ok(r.certifiedValuation,false);
ok(r.fileSha256,null);
ok(Object.isFrozen(r),true);
const suffix=[
 '2026-09-07,الرياض,أرض,2400000,800,1,003,3000',
 '2026-11-07,الرياض,أرض,1200000,600,1,006,2000',
 '2026-09-04,الرياض,أرض,0,600,1,007,0',
 '2026-09-04,الرياض,أرض,900000,600,1,008,1600',
 '2026-09-05,الرياض,أرض,900000,600,1,009,1300',
];
const x=reviewLocalSaudiSaleCsv({...base,csvText:[head,...samples,...suffix].join('\n')});
ok(x.rowsAccepted,4);
ok(x.reasons.DUPLICATE_REFERENCE,1);
ok(x.reasons.DATE_MISSING_INVALID_OR_AFTER_AS_OF,1);
ok(x.reasons.PRICE_OR_AREA_INVALID,1);
ok(x.reasons.REPORTED_PRICE_PER_SQM_CONFLICT,2);
const arabic=reviewLocalSaudiSaleCsv({...base,csvText:
 ['التاريخ;المدينة;نوع العقار;قيمة الصفقة;المساحة;عدد العقارات;رقم الصفقة',
 '٢٠٢٦-٠٩-٠١;الرياض;أرض;١٬٨٠٠٬٠٠٠;٦٠٠;١;A01',
 '٢٠٢٦-٠٩-٠٢;الرياض;أرض;١٨٠٠٠٠٠;٦٠٠;١;A02',
 '٢٠٢٦-٠٩-٠٣;الرياض;أرض;١٨٠٠٠٠٠;٦٠٠;١;A03'].join('\n')});
ok(arabic.rowsAccepted,3);
ok(arabic.groups[0].medianPricePerSqm,3000);
ok(parseAmount('1800٫5'),1800.5);
ok(parseAmount('1,800.5'),1800.5);
ok(parseAmount('1,80'),null);
ok(parseAmount('1800.5foo'),null);
ok(parseAmount('-900'),null);
ok(parseDelimited('a,b\n"x,y",2')[1][0],'x,y');
ok(parseDelimited('a;b\n"x;y";2')[1][0],'x;y');
ok(reviewLocalSaudiSaleCsv({...base,csvText:file,sourceUrl:'https://moj.gov.sa.evil.example/'}).reason,'SOURCE_PROVIDER_URL_NOT_ALLOWLISTED');
ok(reviewLocalSaudiSaleCsv({...base,csvText:file,sourceUrl:'https://demo:pass@www.moj.gov.sa/'}).reason,'SOURCE_PROVIDER_URL_NOT_ALLOWLISTED');
ok(reviewLocalSaudiSaleCsv({...base,csvText:file,sourceProvider:'UNKNOWN'}).reason,'SOURCE_PROVIDER_URL_NOT_ALLOWLISTED');
ok(reviewLocalSaudiSaleCsv({...base,csvText:file,asOf:'2026-02-30'}).reason,'VALID_AS_OF_DATE_REQUIRED');
ok(reviewLocalSaudiSaleCsv({...base,csvText:'date,price\n2026,200'}).reason,'REQUIRED_COLUMNS_MISSING');
ok(reviewLocalSaudiSaleCsv({...base,csvText:'date,date,price\n2026,2026,200'}).reason,'DUPLICATE_HEADER');
ok(reviewLocalSaudiSaleCsv({...base,csvText:'date,transaction_date,price\n2026,2026,200'}).reason,'AMBIGUOUS_COLUMN_DATE');
ok(reviewLocalSaudiSaleCsv({...base,csvText:'A'.repeat(MAX_CSV_BYTES+1)}).reason,'CSV_INVALID_SIZE');
ok(reviewLocalSaudiSaleCsv({...base,csvText:'a,b\n"unterminated'}).reason,'CSV_UNTERMINATED_QUOTE');
ok(reviewLocalSaudiSaleCsv({...base,csvText:'a,b\n"abc"tail,3'}).reason,'CSV_INVALID_QUOTE_SUFFIX');
const panel=fs.readFileSync(path.join(__dirname,'../../src/components/PersonalSaudiSaleCsvPanel.jsx'),'utf8');
const parent=fs.readFileSync(path.join(__dirname,'../../src/components/ValuationIntelligencePanel.jsx'),'utf8');
assert.match(panel,/crypto\.subtle\.digest\('SHA-256',buffer\)/);checks++;
assert.match(panel,/new TextDecoder\('utf-8',\{fatal:true\}\)/);checks++;
assert.match(panel,/MAX_CSV_BYTES/);checks++;
assert.match(panel,/data-testid="personal-saudi-csv-file"/);checks++;
assert.match(panel,/تصدّره بنفسك/);checks++;
assert.match(parent,/<PersonalSaudiSaleCsvPanel locale=\{locale\} \/>/);checks++;
console.log('PRIVATE_SAUDI_CSV_FILE_RESEARCH_INTAKE=PASS assertions='+checks);
console.log('SOURCE_AUTHENTICITY_INDEPENDENTLY_VERIFIED=FALSE');

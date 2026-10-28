import {preview} from 'vite';
import {chromium} from 'playwright';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {findChromiumExecutable}=require('../config/paths');
const evidenceDir='runtime-evidence/location-market-study';
fs.mkdirSync(evidenceDir,{recursive:true});
const result={suite:'STARTAK_LOCATION_MARKET_USER_JOURNEY_V1',tasks:{},errors:[]};
let server,browser;
const mark=(name,ok,note='')=>{result.tasks[name]={status:ok?'PASS':'FAIL',note};if(!ok)throw Error(name+': '+note);};
const assert=(cond,note)=>{if(!cond)throw Error(note);};
const salesCsv=[
'نوع العقار,حالة الصفقة,تاريخ الصفقة,قيمة الصفقة,المساحة المبنية,المدينة,الحي,رقم الصفقة',
'مجمع سكني,إفراغ,2026-10-01,120000000,20000,الرياض,الملقا,S01',
'مجمع سكني,إفراغ,2026-10-01,126000000,20000,الرياض,الملقا,S02',
'مجمع سكني,إفراغ,2026-10-01,114000000,20000,الرياض,الملقا,S03',
].join('\n');
const rentsCsv=[
'نوع العقار,حالة الصفقة,تاريخ العقد,الإيجار السنوي,المساحة التأجيرية,المدينة,الحي,رقم العقد',
'مجمع سكني,موثق,2026-10-01,15000000,20000,الرياض,الملقا,R01',
'مجمع سكني,موثق,2026-10-01,16000000,20000,الرياض,الملقا,R02',
'مجمع سكني,موثق,2026-10-01,14000000,20000,الرياض,الملقا,R03',
].join('\n');
try{
 server=await preview({preview:{host:'127.0.0.1',port:4173,strictPort:false}});
 const addr=server.httpServer.address();const url='http://127.0.0.1:'+addr.port+'/';
 browser=await chromium.launch({headless:true,executablePath:findChromiumExecutable(),
 args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage({viewport:{width:1280,height:960},locale:'ar-SA',acceptDownloads:true});
 page.setDefaultTimeout(10000);
 page.on('pageerror',e=>result.errors.push(e.message));
 page.on('console',msg=>{if(msg.type()==='error')result.errors.push('BROWSER_CONSOLE:'+msg.text());});
 await page.addInitScript(()=>{
  const prefix='STARTAK_REAL_ESTATE:SAVED_DEALS:';
  const id='SYNTH-MKT-BUILD-01';
  const index=[{id,name:'مجمع تجريبي محفوظ'}];
  const deal={id,name:'مجمع تجريبي محفوظ',mode:'building',inputs:{},savedAt:'2026-10-27T00:00:00.000Z'};
  localStorage.setItem(prefix+'deals-index',JSON.stringify(index));
  localStorage.setItem(prefix+'deal:'+id,JSON.stringify(deal));
 });

 const openQuarterFixture=[
  'المنطقة,المدينة,المدينة / الحي,الرقم المرجعي للصفقة,تاريخ الصفقة ميلادي,تصنيف العقار,عدد العقارات,السعر,المساحة',
  'منطقة الرياض,الرياض,الرياض/الملقا,91001,2026/02/15,سكني,1,1200000,600',
  'منطقة الرياض,الرياض,الرياض/الملقا,91002,2026/02/16,سكني,1,1800000,600',
  'منطقة الرياض,الرياض,الرياض/الملقا,91003,2026/02/17,سكني,1,2400000,600',
 ].join('\n');
 await page.route('https://raw.githubusercontent.com/civillizard/Saudi-Real-Estate-Data/main/moj/sales/**',
  async(route)=>{await route.fulfill({status:200,body:openQuarterFixture,
    headers:{'content-type':'text/csv; charset=utf-8','access-control-allow-origin':'*'}});});

 await page.goto(url,{waitUntil:'domcontentloaded'});
 const panel=page.locator('[data-testid="location-market-study"]');
 await panel.waitFor({state:'visible'});
 mark('PANEL_MOUNT',await panel.isVisible());
 const nationalSources=panel.getByTestId('national-intelligence-sources');
 await nationalSources.waitFor({state:'visible'});
 assert((await nationalSources.getByTestId('national-sources-links').locator('a').count())===11,
  'Eleven distinct public real estate source reference URLs must be visible');
 const nationalResearchCSV=[
  'source,city,district,kind,recordId,eventDate,periodStart,periodEnd,metricName,metricValue,unit,sourceUrl,assetType',
  'REGA_REI,الرياض,الملقا,OFFICIAL_AGGREGATE,,,2026-07-01,2026-09-30,deal_count,20,COUNT,https://rei.rega.gov.sa/ar,LAND',
  'GREM_AI,جدة,السلامة,EXTERNAL_AVM_ESTIMATE,SYN-AVM-1,,,,estimated_value_sar,1800000,SAR,https://ai.grem.capital/ar,APARTMENT',
  'MOJ_SREM,الخبر,العليا,OFFICIAL_REPORTED_SALE,SYN-TRAN-1,2026-10-22,,,sale_price_sar,4500000,SAR,https://srem.moj.gov.sa/,LAND',
 ].join('\n');
 await nationalSources.getByTestId('national-observed-on').fill('2026-10-28');
 await nationalSources.getByTestId('national-import-csv').setInputFiles({
  name:'synthetic-nine-sources.csv',mimeType:'text/csv',buffer:Buffer.from(nationalResearchCSV)});
 await nationalSources.getByTestId('national-import-status').filter({hasText:'أضيف 3'}).waitFor();
 await nationalSources.getByTestId('national-source-filter').selectOption('GREM_AI');
 assert((await nationalSources.locator('tbody tr').count())===1,
  'AVM provider must be isolated as an estimate rather than an executed sale');
 assert((await nationalSources.locator('tbody').innerText()).includes('تقدير آلي'),
  'External model output classification not visible');
 await nationalSources.getByTestId('national-city-filter').selectOption('الرياض');
 assert((await nationalSources.locator('tbody tr').count())===0,
  'Foreign city AVM leaked into Riyadh results');
 await nationalSources.getByTestId('national-source-filter').selectOption('MOJ_SREM');
 await nationalSources.getByTestId('national-city-filter').selectOption('الخبر');
 assert((await nationalSources.locator('tbody tr').count())===1,
  'Saudi Ministry of Justice research row not filterable by the correct city');
 assert((await nationalSources.getByTestId('national-summary').innerText()).includes('الصفقات الفردية المثبتة: 0'),
  'Imported public-facing MOJ research cannot self-certify an executed deal');
 mark('NINE_NATIONAL_SOURCES_TYPED_RESEARCH_UI_AND_NO_AUTOVALUATION',true);
 const truCsv=[
 'source,city,district,kind,recordId,eventDate,periodStart,periodEnd,metricName,metricValue,unit,sourceUrl,assetType,rangeLowSar,rangeHighSar,confidenceLabel',
 'BAYUT_TRUVALUE,مكة المكرمة,العوالي,EXTERNAL_AVM_ESTIMATE,SYN-T-1,,,,estimated_value_sar,1800000,SAR,https://www.bayut.sa/property-market-analysis/tru-value/,APARTMENT,1700000,1900000,HIGH'
 ].join('\n');
 await nationalSources.getByTestId('national-import-csv').setInputFiles({
  name:'synthetic-truvalue.csv',mimeType:'text/csv',buffer:Buffer.from(truCsv)});
 await nationalSources.getByTestId('national-import-status').filter({hasText:'أضيف 1'}).waitFor();
 await nationalSources.getByTestId('national-city-filter').selectOption('');
 await nationalSources.getByTestId('national-class-filter').selectOption('');
 await nationalSources.getByTestId('national-source-filter').selectOption('BAYUT_TRUVALUE');
 const bayutMatching= nationalSources.locator('tbody tr').filter({hasText:'ثقة المزود المعلنة: مرتفعة'});
 try { await bayutMatching.waitFor(); }
 catch(e){
  const debug={
   selectedSource:await nationalSources.getByTestId('national-source-filter').inputValue(),
   selectedCity:await nationalSources.getByTestId('national-city-filter').inputValue(),
   selectedClass:await nationalSources.getByTestId('national-class-filter').inputValue(),
   notice:await nationalSources.getByTestId('national-import-status').innerText(),
   rows:await nationalSources.locator('tbody').innerText(),
   summary:await nationalSources.getByTestId('national-summary').innerText(),
  };
  throw Error('BAYUT_TRUVALUE_VIEW_DIAGNOSTIC: '+JSON.stringify(debug)+'; '+e.message);
 }
 assert(await nationalSources.locator('tbody tr').count()===1,'TruValue estimate isolated from official sales');
 assert((await nationalSources.locator('tbody').innerText()).includes('ثقة المزود المعلنة: مرتفعة'),
  'Bayut provider-stated confidence must remain labelled advisory in Arabic');
 mark('BAYUT_TRUVALUE_ADVISORY_INTERVAL_WITHOUT_CLAIMED_MARKET_ACCURACY',true);

 const earth=panel.getByTestId('earth-national-research');
 await earth.waitFor({state:'visible'});
 assert((await earth.getByTestId('earth-links').locator('a').count())===10,
  'All ten exact Earth portal sections must be linked');
 await earth.getByTestId('earth-observed-on').fill('2026-10-28');
 const earthCsv=['المدينة,الحي,رقم الصفقة,تاريخ الصفقة,قيمة الصفقة,المساحة',
  'الرياض,الملقا,SYN-EARTH-100,2026-10-23,5000000,1000',
  'جدة,السلامة,SYN-EARTH-101,2026-10-22,1200000,330'].join('\n');
 await earth.getByTestId('earth-import-csv').setInputFiles({
  name:'synthetic-earth-transactions.csv',mimeType:'text/csv',buffer:Buffer.from(earthCsv)});
 await earth.getByTestId('earth-import-status').filter({hasText:'أضيف 2'}).waitFor();
 await earth.getByTestId('earth-city-filter').selectOption('جدة');
 assert(await earth.locator('tbody tr').count()===1,
  'Earth research national city segregation failed');
 assert((await earth.getByTestId('earth-summary').innerText()).includes('صفقات منفذة مؤكدة: 0'),
  'Third-party reported Earth transaction must never be treated as a certified executed deed');
 mark('EARTH_TEN_SECTION_CATALOG_AND_UNVERIFIED_NATIONAL_IMPORT',true);

 const catalogs=panel.getByTestId('saudi-listing-research');
 await catalogs.waitFor({state:'visible'});
 assert(await catalogs.getByTestId('saudi-listing-sources').locator('a').count()===7,
  'all seven reviewed real estate source links must appear');
 const researchCsv=[
  'source,city,district,kind,priceSar,areaSqm,listingUrl,listingId,assetType,listingDate',
  'عقار,الرياض,الملقا,SALE_OFFER,1500000,300,https://sa.aqar.fm/a/100,100,RESIDENTIAL_VILLA,2026-10-26',
  'ديل,الخبر,العليا,BUYER_REQUEST,900000,300,https://dealapp.sa/ar/tabs/home,200,RESIDENTIAL_VILLA,2026-10-26',
  'سكني,جدة,السلامة,PROJECT_INDICATIVE,900000,170,https://sakani.sa/services/off-plan-projects,300,RESIDENTIAL_VILLA,2026-10-26',
 ].join('\n');
 await catalogs.getByTestId('listing-observed-on').fill('2026-10-28');
 await catalogs.getByTestId('listing-source-csv').setInputFiles({
  name:'synthetic-source-research.csv',mimeType:'text/csv',buffer:Buffer.from(researchCsv)
 });
 await catalogs.getByTestId('listing-import-notice').filter({hasText:'أُضيف 3'}).waitFor();
 await catalogs.getByTestId('listing-platform-filter').selectOption('DEAL');
 assert((await catalogs.locator('tbody tr').count())===1,'Deal requester must not merge into sales');
 assert((await catalogs.locator('tbody').innerText()).includes('طلب عقاري'),
  'buyer-request classification not displayed separately');
 await catalogs.getByTestId('listing-city-filter').selectOption('الرياض');
 assert((await catalogs.locator('tbody tr').count())===0,'cross-city and source leak detected');
 await catalogs.getByTestId('listing-platform-filter').selectOption('');
 assert((await catalogs.locator('tbody tr').count())===1,'Riyadh sale offer missing from catalog');
 mark('SAUDI_SEVEN_SOURCE_NATIONAL_CSV_AND_DEMAND_SEGREGATION',true);

 const national=panel.getByTestId('suhail-national-research');
 await national.waitFor({state:'visible'});
 assert((await national.getByTestId('suhail-scope').innerText()).includes('6'),
  'public Suhail indexed city count should include all 6 city labels, not just Riyadh');
 await national.getByTestId('suhail-city').selectOption('وادي الدواسر');
 assert((await national.locator('tbody tr').count())===2,
  'Wadi Al Dawasir must display two neighborhood rows from public sample');
 assert((await national.locator('tbody').innerText()).includes('أم سمرة'),
  'Wadi Al Dawasir record missing from national source research');
 mark('SUHAIL_NATIONAL_CITY_FILTER_NOT_RIYADH_ONLY',true);
 const nationalCsv=['city,district,transferCount,totalValueSar,residentialSarSqm','جدة,الصفا,2,1500000,5000','الخبر,العليا,1,3500000,6000'].join('\n');
 await national.getByTestId('suhail-research-import').setInputFiles({
  name:'national-research.csv',mimeType:'text/csv',buffer:Buffer.from(nationalCsv)
 });
 await national.getByTestId('suhail-import-status').filter({hasText:'أضيف 2'}).waitFor();
 assert((await national.getByTestId('suhail-import-status').innerText()).includes('أضيف 2'),
  'national CSV import must confirm two new rows');
 assert((await national.getByTestId('suhail-scope').innerText()).includes('8'),
  'National CSV cities must merge into 6 existing cities rather than erasing the original sample');
 assert((await national.getByTestId('suhail-import-status').innerText()).includes('أضيف 2'),
  'National CSV import did not add both records');
 await national.getByTestId('suhail-city').selectOption('الخبر');
 assert((await national.locator('tbody tr').count())===1,
  'Local imported Al Khobar neighborhood must remain separate from Jeddah');
 mark('SUHAIL_NATIONAL_LOCAL_CSV_CITY_DISTRICT_ISOLATION',true);
 await national.getByTestId('suhail-research-import').setInputFiles({
  name:'duplicate-national-research.csv',mimeType:'text/csv',buffer:Buffer.from(nationalCsv)
 });
 await national.getByTestId('suhail-import-status').filter({hasText:'مكرر 2'}).waitFor();
 assert((await national.getByTestId('suhail-import-status').innerText()).includes('مكرر 2'),
  'reimporting identical neighborhood snapshots must deduplicate without new records');
 mark('SUHAIL_CSV_DUPLICATE_DETECTION',true);
 const valuation=panel.getByText('القيمة التقديرية الحسابية اليوم')
   .locator('xpath=..').locator('strong');
 assert((await valuation.innerText()).includes('غير قابل للحساب'),'empty comparable must fail closed');
 mark('NO_DEFAULT_FAKE_MARKET_VALUE',true);
 const fill=async(label,value)=>panel.getByLabel(label,{exact:false}).first().fill(value);
 await fill('الحي','الملقا');
 await fill('رابط موقع العقار من خرائط جوجل أو الإحداثيات','24.75,46.65');
 await fill('مساحة الأرض (م²)','10000');
 await fill('إجمالي المساحات المبنية لكل المباني (م²)','30000');
 await fill('إجمالي المساحة القابلة للتأجير (م²)','25000');
 await fill('عدد العمائر/المباني','5');
 await fill('عدد الوحدات','200');
 await panel.getByLabel('غرض دراسة التقييم').selectOption('ACQUISITION');
 await fill('تاريخ القيمة المطلوب دراستها','2026-10-27');
 await panel.getByLabel('نوع الحق العقاري (يحتاج تحقق)').selectOption('FULL_OWNERSHIP');
 await fill('التصنيف التنظيمي أو الاستعمال المسموح','سكني');
 await panel.getByLabel('حالة المعاينة الفعلية').selectOption('ON_SITE');
 await fill('تاريخ المعاينة الميدانية','2026-10-26');
 mark('LOCATION_PROPERTY_COMPOSITION',((await panel.innerText()).includes('الإحداثيات المستخرجة')));
 const autoResearch=panel.locator('[data-testid="public-moJ-research"]');
 await autoResearch.getByRole('button',{name:'جلب الصفقات المفتوحة الآن وتحليل الحي'}).click();
 await autoResearch.getByText(/صفقات الحي المؤهلة حسب التصنيف العام: 3/).waitFor();
 mark('AUTO_OPEN_LICENSED_MOJ_DOWNLOAD_AND_NEIGHBORHOOD_CONTEXT',true);
 assert((await valuation.innerText()).includes('غير قابل للحساب'),
   'classification-only neighborhood data must NOT turn into a compound valuation');
 mark('OPEN_DATA_SUBTYPE_NON_CONFLATION',true);

 await fill('رابط مجموعة البيانات المفتوحة','https://data.gov.sa/datasets/research-example');
 await panel.getByLabel('أؤكد أن لي حق استخدام هذه البيانات').check();
 const salesInput=panel.locator('[data-testid="public-csv-import"] input[type=file]').nth(0);
 const rentInput=panel.locator('[data-testid="public-csv-import"] input[type=file]').nth(1);
 await salesInput.setInputFiles({name:'sales.csv',mimeType:'text/csv',buffer:Buffer.from(salesCsv,'utf8')});
 await panel.getByText('سجلات البيع المستوردة: 3').waitFor();
 mark('OPEN_DATA_SALES_IMPORT',true);
 await rentInput.setInputFiles({name:'rentals.csv',mimeType:'text/csv',buffer:Buffer.from(rentsCsv,'utf8')});
 await panel.getByText('سجلات الإيجار المستوردة: 3').waitFor();
 mark('OPEN_DATA_RENT_IMPORT',true);
 await panel.getByText(/مقارنات البيع المقبولة: 3/).waitFor();
 const valueAfter=await valuation.innerText();
 assert(!valueAfter.includes('غير قابل للحساب'),'market value should become calculable after 3+3 comps');
 const rentValue=await panel.getByText('الإيجار السوقي السنوي المحتمل').locator('xpath=..').locator('strong').innerText();
 assert(!rentValue.includes('غير قابل للحساب'),'rental estimate should become calculable');
 mark('MARKET_VALUE_AND_RENT_COMPUTED',true,valueAfter+' | '+rentValue);
 const noGap=panel.getByText('فارق مؤشري السوق والدخل:',{exact:false});
 assert((await noGap.innerText()).includes('0.0%'),
  'balanced sale and income methods should agree without a reconciliation hold');
 mark('MARKET_INCOME_BLEND_ONLY_WHEN_COHERENT',true);
 const quality=panel.locator('[data-testid="valuation-quality-gates"]');
 await quality.getByText('مسموح للبحث الشخصي فقط').waitFor();
 await quality.locator('[data-testid="appraisal-report-checklist"] summary').click();
 assert((await quality.innerText()).includes('المراجعة المهنية المستقلة'),
  'report checklist must include external reviewer');
 assert((await quality.innerText()).includes('يتطلب مراجعة خارجية'),
  'a personal research draft must not self-certify an appraisal report');
 mark('QUALITY_GATE_AND_EXTERNAL_PROFESSIONAL_REVIEW_CHECKLIST',true);
 await fill('عدد العمائر/المباني','');
 assert((await valuation.innerText()).includes('غير قابل للحساب'),
   'missing building count must disable blended property price even when financial comparisons exist');
 await fill('عدد العمائر/المباني','5');
 assert((await valuation.innerText())===valueAfter,'corrected subject metadata should reinstate preliminary price');
 mark('BUILDING_COUNT_QUALITY_HARD_GATE_REVALIDATION',true);
 await fill('معدل الرسملة ككسر','0.05');
 assert((await valuation.innerText()).includes('غير قابل للحساب'),
   'material income-vs-comparable conflict must disable blended price');
 await fill('معدل الرسملة ككسر','0.075');
 assert((await valuation.innerText())===valueAfter,'resolved method conflict should restore preliminary price');
 mark('MATERIAL_METHOD_CONFLICT_HARD_GATE_REVALIDATION',true);



 await fill('الإيجار السنوي السابق','999999999');
 const changed=await valuation.innerText();
 assert(changed===valueAfter,'old rent must not change market value');
 mark('OLD_RENT_SEPARATE_FROM_MARKET',true);
 assert((await panel.innerText()).includes('بيع 3، إيجار 3'),'district-only reference must be disclosed');
 mark('DISTRICT_ONLY_MATCH_DISCLOSURE',true);
 const asking=panel.locator('[data-testid="asking-offer-research"]');
 await asking.locator('summary').click();
 const valueBeforeOffers=await valuation.innerText();
 const askingCsv=[
   'نوع العرض,نوع العقار,حالة السعر,تاريخ الإعلان,رابط الإعلان,السعر المطلوب,المساحة المبنية,المدينة,الحي',
   'بيع,مجمع سكني,عرض,2026-10-12,https://sa.aqar.fm/listing/1,6000000,3000,الرياض,الملقا',
   'بيع,مجمع سكني,عرض,2026-10-12,https://sa.aqar.fm/listing/2,9000000,3000,الرياض,الملقا',
   'بيع,مجمع سكني,عرض,2026-10-12,https://sa.aqar.fm/listing/3,12000000,3000,الرياض,الملقا',
 ].join('\n');
 await asking.getByLabel('أؤكد امتلاكي حق استخدام بيانات ملف الإعلانات').check();
 await asking.locator('input[type=file]').setInputFiles({
  name:'asking.csv',mimeType:'text/csv',buffer:Buffer.from(askingCsv,'utf8')
 });
 await asking.getByText('عروض مؤهلة: 3').first().waitFor();
 const offerText=await asking.innerText();
 assert(offerText.includes('مؤشر سعر البيع المطلوب /م²'), 'asking-only sale indicator missing');
 assert((await valuation.innerText())===valueBeforeOffers,
  'asking prices must never affect primary estimated property value');
 mark('AQAR_ASKING_OFFERS_SALE_METER_ISOLATED_FROM_PRIMARY_VALUE',true);

 const professional=panel.locator('[data-testid="professional-comparables"]');
 await professional.locator('summary').first().click();
 mark('PROFESSIONAL_AUDIT_PANEL_VISIBLE',await professional.isVisible());
 await professional.getByLabel('أساس المقارنة (مطابق لكل المقارنات)').selectOption('BUILT_SQM');
 await professional.getByRole('button',{name:'إحضار مقارنات البيع المدخلة للمراجعة'}).click();
 await professional.getByText('سعر المتر المرجّح بعد التقريب إلى هللتين:',{exact:false}).waitFor();
 const gridStatus=await professional.innerText();
 assert(gridStatus.includes('الصفقات المنفذة: 3'),'professional audit did not inherit three source rows');
 assert(!gridStatus.includes('المدخلات غير مكتملة'),'professional audit could not compute with three imported sales');
 mark('PROFESSIONAL_COMPARABLE_IMPORT_AND_ROUNDING',true);
 const method=panel.locator('[data-testid="cross-method-reconciliation"]');
 await method.locator('summary').click();
 await method.getByLabel('سعر المتر للأرض وفق مقارنة موثقة').fill('1000');
 await method.getByLabel('تكلفة إحلال متر المبنى').fill('500');
 await method.getByLabel('الإهلاك المادي والوظيفي الإجمالي').fill('10');
 await method.getByLabel('صافي الدخل التشغيلي السنوي').fill('1000000');
 await method.getByLabel('معدل الرسملة (%)').fill('7');
 await method.getByLabel('إيجار المقارنات السنوي').fill('300');
 await method.getByLabel('إيجار افتراضي كنسبة').fill('5');
 const methodText=await method.innerText();
 assert(methodText.includes('وقف التسوية الآلية بسبب فرق جوهري'),
   'cross-method evidence must HOLD when cost/sales/income spread >20%');
 assert(methodText.includes('فارق الإيجارين'),
   'comparison-based rent versus value percentage should appear separately');
 mark('COST_MARKET_INCOME_RECONCILIATION_HOLD_AND_RENT_BRIDGE',true);
 const unitMix=panel.locator('[data-testid="cohort-unit-mix"]');
 await unitMix.locator('summary').click();
 await unitMix.getByText('لا توجد مجموعتان مؤهلتان',{exact:false}).waitFor();
 mark('COHORT_ASKING_VS_EXECUTED_NOT_ASSUMED_MATCHED',true);
 await unitMix.getByRole('button',{name:'إضافة فئة وحدات'}).click();
 await unitMix.getByLabel('فئة الوحدة').selectOption('APARTMENT_2BR');
 await unitMix.getByLabel('عدد وحدات الفئة').fill('200');
 await unitMix.getByLabel('متوسط المساحة لكل وحدة (م²)').fill('125');
 const today='2026-10-27'; // Same explicit valuation-as-of day supplied above.
 for(let i=0;i<3;i++){
  await unitMix.getByRole('button',{name:'إضافة عقد إيجار مقارن'}).click();
  await unitMix.getByLabel('نوع الوحدة المطابق').nth(i).selectOption('APARTMENT_2BR');
  await unitMix.getByLabel('تاريخ العقد').nth(i).fill(today);
  await unitMix.getByLabel('الإيجار السنوي للعقد (ريال)').nth(i).fill(String((80+i*5)*1000));
  await unitMix.getByLabel('المساحة التأجيرية للعقد (م²)').nth(i).fill('125');
  await unitMix.getByLabel('معرّف غير شخصي للعقد').nth(i).fill('SYNTH-L'+i);
  await unitMix.getByLabel('رابط الدليل الأصلي (رابط آمن)').nth(i)
   .fill('https://data.gov.sa/synthetic-contract-'+i);
 }
 await unitMix.getByText('الإيجار السوقي السنوي الإجمالي المحتمل:',{exact:false})
  .waitFor();
 const segmentText=await unitMix.innerText();
 assert(segmentText.includes('17,000,000')||segmentText.includes('١٧٬٠٠٠٬٠٠٠'),
  'unit-class rent should match 200 x 125 sqm x annual lease median');
 mark('UNIT_CLASS_CONTRACT_RENT_RECONCILIATION_AND_FORM',true);
 const exportButton=panel.getByTestId('personal-market-study-export');
 await exportButton.scrollIntoViewIfNeeded();
 // Settle both operations so click failures cannot be masked by an unhandled
 // download listener rejected when the test closes the browser.
 const outcomes=await Promise.allSettled([
   page.waitForEvent('download',{timeout:20000}),
   exportButton.click({timeout:12000}),
 ]);
 if(outcomes.some(x=>x.status==='rejected')){
   const statuses=await panel.locator('p[role="status"]').allTextContents();
   throw new Error('PERSONAL_STUDY_DOWNLOAD_FAILURE; click='+
     (outcomes[1].status==='rejected'?outcomes[1].reason?.message:'OK')+
     '; download='+(outcomes[0].status==='rejected'?outcomes[0].reason?.message:'OK')+
     '; ui='+statuses.filter(x=>/تنزيل|تصدير|خطأ|تعذر/.test(x)).join(' | ').slice(0,700)+
     '; browserErrors='+result.errors.slice(-4).join(' | '));
 }
 const download=outcomes[0].value;
 const saved=await download.path();
 const exported=JSON.parse(fs.readFileSync(saved,'utf8'));
 assert(exported.kind==='STARTAK_PERSONAL_MARKET_STUDY','missing study identity');
 assert(exported.unitMix?.length===1&&exported.leaseComparables?.length===3,
  'segmented unit mix and lease comparables missing from exported study');
 assert(exported.segmentedMarketRents?.grossPotentialNewAnnualRentSar===17000000,
  'new class-level rent does not reconcile to exported study');
 assert(exported.askingVsExecutedCohorts?.notSamePropertyProof===true,
  'executed vs asking cohorts were misleadingly treated as identical asset deals');
 assert(exported.valuationReadiness?.status==='PRELIMINARY_CALCULATION_UNVERIFIED',
  'preliminary value export must contain case evidence gate');
 assert(exported.appraisalQuality?.certifiedReportExportAllowed===false,
  'researcher-supplied metadata cannot certify a professional valuation');
 assert(exported.subject?.valuationPurpose==='ACQUISITION',
  'appraisal purpose metadata missing from saved study');
 assert(exported.rentAssumptions?.stabilizedOccupancy==='0.90',
  'rent operating assumption missing from export');
 mark('FULL_PERSONAL_STUDY_EXPORT_INCLUDES_UNIT_MIX_LEASE_EVIDENCE',true);
 await fill('الإيجار السنوي السابق','1');
 await panel.getByTestId('personal-market-study-import').setInputFiles({
  name:'restored-startak.json',mimeType:'application/json',
  buffer:Buffer.from(fs.readFileSync(saved))
 });
 await panel.getByText('استُعيدت مدخلات الدراسة الخاصة محليًا',{exact:false}).waitFor();
 assert((await unitMix.innerText()).includes('17,000,000')||
    (await unitMix.innerText()).includes('١٧٬٠٠٠٬٠٠٠'),
   'restoring study must recalculate the same new-rent output');
 const historicalAfterImport=await panel.getByLabel('الإيجار السنوي السابق').first().inputValue();
 assert(historicalAfterImport==='999999999','restored prior rent input did not round-trip');
 mark('REIMPORT_PERSONAL_STUDY_RESTORES_INPUTS_AND_RECALCULATES_RESULTS',true);
 const resetFusion=panel.getByTestId('research-evidence-fusion');
 const resetText=await resetFusion.getByTestId('fusion-statistics').innerText();
 assert(resetText.includes('السجلات البحثية: 10'),
  'Restoring study must quarantine imports from previous case and retain only public Suhail sample');
 mark('RESTORED_CASE_RESEARCH_CONTEXT_ISOLATION',true);
 const linked=panel.locator('[data-testid="saved-deal-market-study-link"]');
 await linked.getByRole('button',{name:'تحديث قائمة الصفقات المحفوظة'}).click();
 await linked.getByLabel('اختيار الصفقة لربط دراسة السوق').selectOption('SYNTH-MKT-BUILD-01');
 const savedDealBefore=await page.evaluate(()=>
  localStorage.getItem('STARTAK_REAL_ESTATE:SAVED_DEALS:deal:SYNTH-MKT-BUILD-01'));
 await linked.getByLabel('أؤكد أن الدراسة تخص العقار نفسه').check();
 await linked.getByRole('button',{name:'حفظ ملحق الدراسة للصفقة المختارة'}).click();
 await linked.getByText('تم حفظ ملحق الدراسة البحثية للصفقة',{exact:false}).waitFor();
 const sidecar=await page.evaluate(()=>localStorage.getItem(
  'STARTAK_REAL_ESTATE:SAVED_DEALS:market-study-sidecar:v1:SYNTH-MKT-BUILD-01'));
 const decoded=JSON.parse(sidecar);
 assert(decoded.researchScope==='PERSONAL_UNVERIFIED_INPUTS_ONLY'&&decoded.studyInputs.unitMix.length===1,
  'research must be linked solely as unapproved inputs');
 assert(decoded.studyInputs.appraisalQuality===undefined&&decoded.studyInputs.report===undefined,
  'certified outputs must not persist in canonical sidecar');
 assert((await page.evaluate(()=>localStorage.getItem(
  'STARTAK_REAL_ESTATE:SAVED_DEALS:deal:SYNTH-MKT-BUILD-01')))===savedDealBefore,
  'canonical saved-deal record was modified by research sidecar');
 mark('CANONICAL_DEAL_LINKED_RESEARCH_INPUTS_ISOLATED',true);
 await linked.getByRole('button',{name:'حفظ ملحق الدراسة للصفقة المختارة'}).click();
 await linked.getByText('هذه الصفقة مرتبطة بدراسة سابقة',{exact:false}).waitFor();
 mark('RESEARCH_SIDECAR_OVERWRITE_REQUIRES_EXPLICIT_CONSENT',true);
 await linked.getByRole('button',{name:'استعادة ملحق الدراسة المرتبط'}).click();
 await linked.getByText('استُعيدت مدخلات الملحق المرتبط بالصفقة',{exact:false}).waitFor();
 mark('CANONICAL_DEAL_RESEARCH_RESTORE_RECALCULATES',true);






 const fusion=panel.getByTestId('research-evidence-fusion');
 await fusion.waitFor({state:'visible'});
 assert((await fusion.getByTestId('fusion-statistics').innerText()).includes('السجلات البحثية:'),
  'Unified multi-source research totals must be shown');
 assert((await fusion.getByTestId('fusion-risk-codes').innerText()).includes('RESEARCH_ONLY_NOT_INDEPENDENTLY_VERIFIED'),
  'Combined data must never grant a certified price or investment decision');
 const [fusionDownload]=await Promise.all([
  page.waitForEvent('download'),fusion.getByTestId('fusion-export').click()]);
 const fusionJson=JSON.parse(fs.readFileSync(await fusionDownload.path(),'utf8'));
 assert(fusionJson.openDataAnnex?.professionalComparableEligible===false,
  'Public historic neighborhood data may not become professional comparable automatically');
 assert(fusionJson.valuationSar===null&&fusionJson.maximumPurchaseSar===null&&
  fusionJson.investmentDecision==='HOLD_REQUIRES_INDEPENDENT_MARKET_AND_FINANCIAL_EVIDENCE',
  'Research evidence export must not contain an invented certified market value or buy price');
 assert(fusionJson.studySummary.validRows>=10,
  'Public Suhail sample must be included in the unified source evidence context');
 mark('UNIFIED_RESEARCH_EVIDENCE_JOIN_AND_SAFE_EXPORT',true);
 await page.setViewportSize({width:390,height:844});
 const geom=await page.evaluate(()=>({width:document.documentElement.scrollWidth,
 viewport:document.documentElement.clientWidth}));
 mark('MOBILE_NO_OVERFLOW',geom.width<=geom.viewport+5,JSON.stringify(geom));
 mark('NO_RUNTIME_PAGE_ERRORS',result.errors.length===0,JSON.stringify(result.errors));
}catch(e){
 result.error=e.stack||e.message;process.exitCode=1;
}finally{
 if(browser)await browser.close();
 if(server)await new Promise(done=>server.httpServer.close(done));
 fs.writeFileSync(evidenceDir+'/browser-e2e.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));
}

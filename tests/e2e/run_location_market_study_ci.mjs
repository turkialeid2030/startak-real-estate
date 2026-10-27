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
'مجمع سكني,موثق,2026-10-01,20000000,20000,الرياض,الملقا,R01',
'مجمع سكني,موثق,2026-10-01,22000000,20000,الرياض,الملقا,R02',
'مجمع سكني,موثق,2026-10-01,18000000,20000,الرياض,الملقا,R03',
].join('\n');
try{
 server=await preview({preview:{host:'127.0.0.1',port:4173,strictPort:false}});
 const addr=server.httpServer.address();const url='http://127.0.0.1:'+addr.port+'/';
 browser=await chromium.launch({headless:true,executablePath:findChromiumExecutable(),
 args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage({viewport:{width:1280,height:960},locale:'ar-SA'});
 page.setDefaultTimeout(10000);
 page.on('pageerror',e=>result.errors.push(e.message));
 const openQuarterFixture=[
  'المنطقة,المدينة,المدينة / الحي,الرقم المرجعي للصفقة,تاريخ الصفقة ميلادي,تصنيف العقار,عدد العقارات,السعر,المساحة',
  'منطقة الرياض,الرياض,الرياض/الملقا,91001,2026/02/15,سكني,1,1200000,600',
  'منطقة الرياض,الرياض,الرياض/الملقا,91002,2026/02/16,سكني,1,1800000,600',
  'منطقة الرياض,الرياض,الرياض/الملقا,91003,2026/02/17,سكني,1,2400000,600',
 ].join('\\n');
 await page.route('https://raw.githubusercontent.com/civillizard/Saudi-Real-Estate-Data/main/moj/sales/**',
  async(route)=>{await route.fulfill({status:200,body:openQuarterFixture,
    headers:{'content-type':'text/csv; charset=utf-8','access-control-allow-origin':'*'}});});

 await page.goto(url,{waitUntil:'domcontentloaded'});
 const panel=page.locator('[data-testid="location-market-study"]');
 await panel.waitFor({state:'visible'});
 mark('PANEL_MOUNT',await panel.isVisible());
 const valuation=panel.getByText('القيمة التقديرية الحسابية اليوم')
   .locator('xpath=..').locator('strong');
 assert((await valuation.innerText()).includes('غير قابل للحساب'),'empty comparable must fail closed');
 mark('NO_DEFAULT_FAKE_MARKET_VALUE',true);
 const fill=async(label,value)=>panel.getByLabel(label,{exact:false}).first().fill(value);
 await fill('الحي','الملقا');
 await fill('رابط اللوكيشن من Google Maps أو الإحداثيات','24.75,46.65');
 await fill('إجمالي المساحات المبنية لكل المباني (م²)','30000');
 await fill('إجمالي المساحة القابلة للتأجير (م²)','25000');
 await fill('عدد العمائر/المباني','5');
 await fill('عدد الوحدات','200');
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
 await fill('الإيجار السنوي السابق','999999999');
 const changed=await valuation.innerText();
 assert(changed===valueAfter,'old rent must not change market value');
 mark('OLD_RENT_SEPARATE_FROM_MARKET',true);
 assert((await panel.innerText()).includes('بيع 3، إيجار 3'),'district-only reference must be disclosed');
 mark('DISTRICT_ONLY_MATCH_DISCLOSURE',true);
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

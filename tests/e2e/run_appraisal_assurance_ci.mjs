import {preview} from 'vite';
import {chromium} from 'playwright';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {findChromiumExecutable}=require('../config/paths');
let server,browser;
function assert(condition,label){if(!condition)throw Error(label);}
const checks=[];
const pass=label=>{checks.push(label);console.log('PASS '+label);};
try {
 server=await preview({preview:{host:'127.0.0.1',port:4173,strictPort:false}});
 const url='http://127.0.0.1:'+server.httpServer.address().port+'/';
 browser=await chromium.launch({headless:true,executablePath:findChromiumExecutable(),args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage({locale:'ar-SA',viewport:{width:1280,height:900}});
 page.setDefaultTimeout(15000);
 await page.goto(url,{waitUntil:'domcontentloaded'});
 const work=page.getByTestId('appraisal-assurance-workbench');
 await work.waitFor({state:'visible'});
 await work.getByTestId('appraisal-assurance-toggle').click();
 assert(await work.getByTestId('appraisal-audit-status').getAttribute('data-status')==='REVIEW_REQUIRED','blank status fail-closed');
 pass('Arabic manual workbench mounts with review-only status');
 await work.getByTestId('current-reportId').fill('SYN-001');
 await work.getByTestId('current-valuationDate').fill('2026-01-01');
 await work.getByTestId('current-income-annualNoiSar').fill('٢٬١٠٠٬٠٠٠');
 await work.getByTestId('current-income-capitalizationRatePct').fill('7');
 await work.getByTestId('current-income-indicatedValueSar').fill('55000000');
 assert(await work.getByTestId('appraisal-audit-status').getAttribute('data-status')==='HOLD','arithmetic mismatch must hold');
 assert(await work.getByTestId('appraisal-issues').getByText('INCOME_CAPITALIZATION_MISMATCH').count()>0,'income error not shown');
 assert(!(await work.getByTestId('appraisal-calculated-value').innerText()).includes('—'),'computed value missing');
 pass('Arabic thousands separators compute independent capitalization and detect mismatch');
 await work.getByTestId('current-marketRent-capitalValueBasisSar').fill('7100000');
 await work.getByTestId('current-marketRent-percentOfCapitalValue').fill('5');
 await work.getByLabel('مصدر الإيجار').first().selectOption('CAPITAL_VALUE_PERCENTAGE');
 await work.getByLabel('استُخدم هذا الإيجار نفسه لحساب قيمة أسلوب الدخل').first().check();
 assert(await work.getByTestId('appraisal-issues').getByText('CIRCULAR_VALUATION').count()>0,'circular valuation must be shown');
 pass('circular valuation explicitly blocked');
 await work.getByTestId('current-reported-capitalValueSar').fill('7100000');
 await work.getByTestId('current-reported-marketRentSar').fill('284000');
 await work.getByTestId('appraisal-version-compare').check();
 await work.getByTestId('previous-reportId').fill('SYN-001');
 await work.getByTestId('previous-reported-capitalValueSar').fill('7100000');
 await work.getByTestId('previous-reported-marketRentSar').fill('213000');
 assert(await work.getByTestId('appraisal-version-differences').getByText('DEPENDENT_VALUE_UNCHANGED').count()>0,'version change must be visible');
 pass('same-report version changes detected without value double count');
 await work.getByTestId('appraisal-reset').click();
 assert(await work.getByTestId('appraisal-audit-status').getAttribute('data-status')==='REVIEW_REQUIRED','reset should clear material errors');
 assert(await work.getByTestId('current-reportId').inputValue()==='','reset should clear values');
 pass('local data cleared without saving or approving');
 assert((await work.getByText('لا يوجد زر اعتماد أو تصدير تقرير مهني.').count())===1,'professional export boundary absent');
 pass('professional report export unavailable');
 console.log('APPRAISAL_BROWSER_SMOKE=PASS CASES='+checks.length);
} catch(e) {
 console.error('APPRAISAL_BROWSER_SMOKE=FAIL: '+(e.stack||e.message));
 process.exitCode=1;
} finally {
 if(browser)await browser.close();
 if(server)await new Promise(resolve=>server.httpServer.close(resolve));
}

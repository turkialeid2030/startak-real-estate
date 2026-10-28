import {preview} from 'vite';
import {chromium} from 'playwright';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {findChromiumExecutable}=require('../config/paths');
const {financialAndValuationLabels}=require('../../src/app/personal-study-status-clarity');
let server,browser;
const assert=(condition,message)=>{if(!condition)throw Error(message);};
try{
 server=await preview({preview:{host:'127.0.0.1',port:4173,strictPort:false}});
 const url='http://127.0.0.1:'+server.httpServer.address().port+'/';
 browser=await chromium.launch({headless:true,executablePath:findChromiumExecutable(),args:['--no-sandbox']});
 const page=await browser.newPage({locale:'ar-SA',viewport:{width:1280,height:900},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url,{waitUntil:'domcontentloaded'});
 const research=page.getByTestId('c75-personal-research-workspace');
 await research.waitFor();
 const pending=page.waitForEvent('download');
 await research.getByTestId('c75-export-personal-json').click();
 const saved=await pending;
 const draft=JSON.parse(await readFile(await saved.path(),'utf8'));
 const expected=financialAndValuationLabels(draft,'ar-SA');
 const financial=await research.getByTestId('c75-financial-status').innerText();
 assert(financial.includes(expected.financialLabel),
  'D07 financial label must match its independent exported calculation status, not valuation readiness');
 const appraisal=await research.getByTestId('c75-personal-status').innerText();
 assert(appraisal.includes(expected.additionalValuationLabel),
  'D07 additional valuation label must match exported valuation status separately');
 assert(draft.financial?.status!=='', 'D07 report contains the financial status');
 const market=page.getByTestId('location-market-study');
 const bridge=market.getByTestId('market-financial-identity-bridge');
 await bridge.waitFor();
 assert((await bridge.getByTestId('market-financial-bridge-status').innerText())
   .includes('USER_CONFIRMATION_REQUIRED'),'D06 must provide only opt-in transfer');
 const apply=bridge.getByTestId('market-financial-bridge-apply');
 assert(await apply.isDisabled(),'D06 transfer must require user acknowledgement');
 // The building model cannot guess the market asset class from its name.
 await bridge.locator('select').selectOption('OFFICE_TOWER');
 assert(await apply.isDisabled(),'D06 transfer must still require acknowledgement');
 await bridge.locator('input[type=checkbox]').check();
 await apply.click();
 const name=await market.getByLabel('اسم العقار').inputValue();
 assert(name.includes('مبنى مكتبي قائم'),'D06 current financial project name must transfer');
 assert(await market.getByLabel('المدينة').inputValue()==='الرياض',
  'D06 must preserve city rather than pretend the title verifies location');
 assert(await market.getByLabel('نوع العقار',{exact:true}).inputValue()==='OFFICE_TOWER',
  'D06 asset class must be the expressly chosen option');
 assert(errors.length===0,'React browser failures: '+errors.slice(0,2).join(', '));
 console.log('D06_D07_REAL_CHROMIUM=PASS financial_and_valuation_states_separate=true inferred_title=false');
}catch(e){console.error('D06_D07_REAL_CHROMIUM=FAIL '+String(e.stack||e));process.exitCode=1;}
finally{if(browser)await browser.close();if(server)await server.httpServer.close();}

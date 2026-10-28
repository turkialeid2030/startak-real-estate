import {preview} from 'vite';
import {chromium} from 'playwright';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {findChromiumExecutable}=require('../config/paths');
let server,browser;
const assert=(condition,message)=>{if(!condition)throw Error(message);};
try{
 server=await preview({preview:{host:'127.0.0.1',port:4173,strictPort:false}});
 const url='http://127.0.0.1:'+server.httpServer.address().port+'/';
 browser=await chromium.launch({headless:true,executablePath:findChromiumExecutable(),args:['--no-sandbox']});
 const page=await browser.newPage({locale:'ar-SA',viewport:{width:1280,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url,{waitUntil:'domcontentloaded'});
 const research=page.getByTestId('c75-personal-research-workspace');
 await research.waitFor();
 const financial=(await research.getByTestId('c75-financial-status').innerText());
 assert(financial.includes('الحساب المالي')&&financial.includes('صالح حسابيًا'),
  'D07 must show current financial case validity independently');
 const appraisal=await research.getByTestId('c75-personal-status').innerText();
 assert(appraisal.length>0,'D07 separate additional valuation status must appear');
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
 console.log('D06_D07_REAL_CHROMIUM=PASS current_financial_status=VALID inferred_title=false');
}catch(e){console.error('D06_D07_REAL_CHROMIUM=FAIL '+String(e.stack||e));process.exitCode=1;}
finally{if(browser)await browser.close();if(server)await server.httpServer.close();}

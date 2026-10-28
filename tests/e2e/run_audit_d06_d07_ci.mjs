import {preview} from 'vite';
import {chromium} from 'playwright';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {findChromiumExecutable}=require('../config/paths');
const {financialAndValuationLabels}=require('../../src/app/personal-study-status-clarity');
const gold=require('../reference/RE-GOLD-baseline.json');
const ar=require('../../src/i18n/locales/ar-SA');
const namespace=require('../../src/storage/browser-local-storage-provider').NAMESPACE;
const STUDY='AUDIT-D06-IDENTITY-SYNTHETIC';

let server,browser;
const assert=(condition,message)=>{if(!condition)throw Error(message);};
try{
 server=await preview({preview:{host:'127.0.0.1',port:4173,strictPort:false}});
 const url='http://127.0.0.1:'+server.httpServer.address().port+'/';
 browser=await chromium.launch({headless:true,executablePath:findChromiumExecutable(),args:['--no-sandbox']});
 const page=await browser.newPage({locale:'ar-SA',viewport:{width:1280,height:900},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const seed={id:'audit-d06-identity',name:STUDY,mode:'building',
  savedAt:'2026-10-28T00:00:00.000Z',inputs:gold['RE-GOLD-002_existing_building'].inputs};
 await page.addInitScript(({namespace,seed})=>{
   localStorage.setItem(namespace+'deal:'+seed.id,JSON.stringify(seed));
   localStorage.setItem(namespace+'deals-index',
      JSON.stringify([{id:seed.id,name:seed.name,mode:seed.mode,savedAt:seed.savedAt}]));
 },{namespace,seed});
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.getByTitle(ar.actions.savedDeals,{exact:true}).click();
 const dialog=page.getByRole('dialog',{name:ar.savedDeals.panelTitle});
 await dialog.getByRole('button',{name:STUDY,exact:true}).click();
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
 const observedBridge=await bridge.getByTestId('market-financial-bridge-status').innerText();
 assert(observedBridge.includes('USER_CONFIRMATION_REQUIRED'),
  'D06 valid saved financial case must offer opt-in bridge; observed='+observedBridge);
 const apply=bridge.getByTestId('market-financial-bridge-apply');
 assert(await apply.isDisabled(),'D06 transfer must require user acknowledgement');
 // The building model cannot guess the market asset class from its name.
 await bridge.locator('select').selectOption('OFFICE_TOWER');
 assert(await apply.isDisabled(),'D06 transfer must still require acknowledgement');
 await bridge.locator('input[type=checkbox]').check();
 await apply.click();
 const name=await market.getByLabel('اسم العقار').inputValue();
 assert(name===STUDY,'D06 current user-saved financial deal identity must transfer without guessing');
 assert(await market.getByLabel('المدينة',{exact:true}).first().inputValue()==='الرياض',
  'D06 must preserve city rather than pretend the title verifies location');
 assert(await market.getByTestId('market-subject-asset-type').inputValue()==='OFFICE_TOWER',
  'D06 asset class must be the expressly chosen option');
 await page.getByRole('button',{name:'EN',exact:true}).click();
 await market.getByTestId('market-partial-locale-notice').waitFor();
 assert(await market.getAttribute('dir')==='ltr','D04 core market panel direction switches to LTR');
 assert((await market.locator('h2').first().innerText()).includes('Property location'),
  'D04 English market heading must be visible');
 assert(await market.getByLabel('Property name',{exact:true}).first().inputValue()===STUDY,
  'D04 locale switch must not change financial-to-market identity values');
 assert((await market.getByTestId('market-subject-asset-type').inputValue())==='OFFICE_TOWER',
  'D04 locale switch must not change machine asset classification');
 assert((await market.getByTestId('market-subject-asset-type').innerText()).includes('Office tower'),
  'D04 should localize asset enum labels without changing enum values');
 assert((await bridge.innerText()).includes('Optional property identity link'),
  'D04 must localize explicit-consent section');
 assert((await market.getByTestId('market-partial-locale-notice').innerText())
  .includes('not fully localized'),'D04 must disclose incomplete advanced-section translation');
 const fusion=page.getByTestId('research-evidence-fusion');
 await fusion.waitFor({state:'visible'});
 assert(await fusion.getAttribute('dir')==='ltr',
  'D04 multi-source research panel must switch direction to English');
 assert((await fusion.locator('h3').first().innerText()).includes('Multi-source market evidence'),
  'D04 evidence integration English heading visible');
 assert((await fusion.getByTestId('fusion-status').innerText()).includes('HOLD'),
  'D04 must preserve HOLD state in English');
 assert((await fusion.getByTestId('fusion-statistics').innerText()).includes('Independently verified executed sales'),
  'D04 must distinguish verified executed transactions from research rows');
 const suhail=page.getByTestId('suhail-national-research');
 await suhail.waitFor({state:'visible'});
 assert(await suhail.getAttribute('dir')==='ltr','D04 Suhail research panel direction');
 assert((await suhail.locator('h3').first().innerText()).includes('Saudi neighborhood indicators'),
  'D04 Suhail English sample warning visible');
 assert((await suhail.getByTestId('suhail-scope').innerText())
  .includes('Independently confirmed individual transactions: 0'),
  'D04 Suhail must not claim verified executed sales after locale switch');
 await page.getByTestId('locale-switch').click();
 assert(await fusion.getAttribute('dir')==='rtl','D04 restores Arabic research panel direction');
 assert(await suhail.getAttribute('dir')==='rtl','D04 restores Arabic neighborhood panel direction');
 assert((await fusion.getByTestId('fusion-status').textContent()).includes('HOLD'),
  'D04 Arabic HOLD state retained in DOM, including immediately after language switch');
 assert(errors.length===0,'React browser failures: '+errors.slice(0,2).join(','));
 console.log('D06_D07_REAL_CHROMIUM=PASS financial_and_valuation_states_separate=true inferred_title=false');
}catch(e){console.error('D06_D07_REAL_CHROMIUM=FAIL '+String(e.stack||e));process.exitCode=1;}
finally{if(browser)await browser.close();if(server)await server.httpServer.close();}

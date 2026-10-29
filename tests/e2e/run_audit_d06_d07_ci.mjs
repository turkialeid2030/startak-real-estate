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
 const national=page.getByTestId('national-intelligence-sources');
 await national.waitFor({state:'visible'});
 assert(await national.getAttribute('dir')==='ltr',
  'D04 national market evidence must use LTR in English');
 assert((await national.locator('h3').first().innerText()).includes('Saudi official and third-party'),
  'D04 national sources heading must localize');
 const classFilter=national.getByTestId('national-class-filter');
 const originalClassValue=await classFilter.inputValue();
 const sourceUrl=national.locator('[data-testid="national-sources-links"] a').first();
 const originalUrl=await sourceUrl.getAttribute('href');
 assert((await national.getByTestId('national-summary').innerText())
  .includes('Independently verified executed transactions:'),
  'D04 English source review must not imply unverified sales are authentic');
 assert((await national.getByTestId('national-language-scope').innerText())
  .includes('does not validate any source'),
  'D04 provider original-language caveat remains explicit');
 assert((await national.getByTestId('national-class-filter').innerText())
  .includes('Official aggregated indicator'),
  'D04 evidence class labels translated without changing machine class');
 const listings=page.getByTestId('saudi-listing-research');
 const advanced=[
  [page.getByTestId('asking-offer-research'),'Market asking listings'],
  [page.getByTestId('professional-comparables'),'Comparable review'],
  [page.getByTestId('cross-method-reconciliation'),'Method and market rent reconciliation'],
  [page.getByTestId('cohort-unit-mix'),'Asking and executed-sale cohorts']
 ];
 for(const [panel,title] of advanced){
  assert(await panel.getAttribute('dir')==='ltr','D04 advanced English direction');
  assert((await panel.locator('summary').first().innerText()).includes(title),'D04 advanced heading '+title);
  await panel.locator('summary').first().click();
 }
 const asking=advanced[0][0],professional=advanced[1][0],methods=advanced[2][0],mix=advanced[3][0];
 await asking.getByRole('button',{name:'Add sale or rental listing',exact:true}).click();
 await asking.getByLabel('Asking sale price (SAR)',{exact:true}).fill('123456.78');
 await asking.getByLabel('Original listing URL (secure)',{exact:true}).fill('https://example.org/synthetic-d04');
 await professional.getByLabel('Comparison basis (same for all comparables)',{exact:true}).selectOption('BUILT_SQM');
 await professional.getByLabel('Unadjusted price per sqm (SAR)',{exact:true}).first().fill('12500.25');
 await methods.getByLabel('Building replacement cost (SAR/sqm)',{exact:true}).fill('2500.50');
 await mix.getByRole('button',{name:'Add unit class',exact:true}).click();
 await mix.getByLabel('Unit class',{exact:true}).last().selectOption('APARTMENT_2BR');
 await mix.getByLabel('Class unit count',{exact:true}).last().fill('12');
 const advancedBefore=await page.locator('[data-testid="asking-offer-research"], [data-testid="professional-comparables"], [data-testid="cross-method-reconciliation"], [data-testid="cohort-unit-mix"]').evaluateAll(nodes=>
  nodes.flatMap(node=>Array.from(node.querySelectorAll('input:not([type=file]),select')).map(x=>({type:x.type,value:x.value,checked:x.checked}))));
 const earth=page.getByTestId('earth-national-research');
 const challenger=page.getByTestId('challenger-benchmark-research');
 for(const [panel,title] of [[listings,'Saudi property listings'],[earth,'Earth — reported transactions'],
   [challenger,'Challenger model comparison']]){
  assert(await panel.getAttribute('dir')==='ltr','D04 English research source direction');
  assert((await panel.locator('h3').innerText()).includes(title),'D04 source heading: '+title);
 }
 await listings.getByTestId('listing-observed-on').fill('2026-10-28');
 await listings.getByTestId('listing-source-csv').setInputFiles({name:'synthetic-listings.csv',mimeType:'text/csv',
  buffer:Buffer.from('source,city,district,kind,priceSar,areaSqm,listingUrl,listingId,assetType,listingDate\n'+
   'DEAL,الرياض,الملقا,BUYER_REQUEST,100000,100,https://dealapp.sa/request/synthetic-d04,SYNTH-D04,LAND,2026-10-01')});
 assert((await listings.getByTestId('listing-import-notice').innerText()).includes('Added 1;'),
  'D04 translated import notice retains accepted row count');
 await listings.getByTestId('listing-kind-filter').selectOption('BUYER_REQUEST');
 assert((await listings.locator('tbody').innerText()).includes('Buyer request / budget'),
  'D04 buyer budgets cannot become executed sale prices');
 const listingHref=await listings.locator('tbody a').getAttribute('href');
 await earth.getByTestId('earth-feature').selectOption('RENTAL_DEALS');
 const earthHref=await earth.locator('[data-testid="earth-links"] a').first().getAttribute('href');
 assert((await fusion.getByTestId('fusion-review-actions').innerText())
  .includes('Match the property location, title, parcel and plan'),'D04 reviewer tasks localized');
 const htmlPending=page.waitForEvent('download');
 await fusion.getByTestId('fusion-export-html').click();
 const htmlDownload=await htmlPending;
 const englishHtml=await readFile(await htmlDownload.path(),'utf8');
 assert(englishHtml.includes('<html lang="en" dir="ltr">')&&
  englishHtml.includes('HOLD / NOT_AUTHORIZED'),'D04 English download retains HOLD');
 await page.getByTestId('locale-switch').click();
 assert(await national.getAttribute('dir')==='rtl',
  'D04 national panel restores RTL');
 assert(await classFilter.inputValue()===originalClassValue,
  'D04 never changes evidence class selection on language switch');
 assert(await sourceUrl.getAttribute('href')===originalUrl,
  'D04 never changes source URL on language switch');
 assert((await national.locator('h3').first().innerText()).includes('مصادر البيانات الرسمية'),
  'D04 national source heading restores Arabic');
 assert(await listings.getByTestId('listing-kind-filter').inputValue()==='BUYER_REQUEST',
  'D04 nonempty listing class remains unchanged');
 assert(await earth.getByTestId('earth-feature').inputValue()==='RENTAL_DEALS',
  'D04 nonempty Earth feature remains unchanged');
 assert(await listings.locator('tbody a').getAttribute('href')===listingHref&&
  await earth.locator('[data-testid="earth-links"] a').first().getAttribute('href')===earthHref,
  'D04 source URLs retain original values');
 assert((await listings.getByTestId('listing-import-notice').textContent()).includes('أُضيف 1'),
  'D04 earlier import notice updates language without reimport');
 assert((await listings.locator('tbody').textContent()).includes('طلب عقاري / ميزانية'),
  'D04 imported evidence restores Arabic classification');
 for(const panel of [listings,earth,challenger])assert(await panel.getAttribute('dir')==='rtl',
  'D04 source panels restore Arabic direction');
 for(const [panel] of advanced)assert(await panel.getAttribute('dir')==='rtl','D04 advanced RTL restored');
 const advancedAfter=await page.locator('[data-testid="asking-offer-research"], [data-testid="professional-comparables"], [data-testid="cross-method-reconciliation"], [data-testid="cohort-unit-mix"]').evaluateAll(nodes=>
  nodes.flatMap(node=>Array.from(node.querySelectorAll('input:not([type=file]),select')).map(x=>({type:x.type,value:x.value,checked:x.checked}))));
 assert(JSON.stringify(advancedBefore)===JSON.stringify(advancedAfter),
  'D04 locale switch must preserve every advanced field, source URL, amount, enum and checkbox');
 assert(await fusion.getAttribute('dir')==='rtl','D04 restores Arabic research panel direction');
 assert(await suhail.getAttribute('dir')==='rtl','D04 restores Arabic neighborhood panel direction');
 await page.waitForFunction(()=>{
   const element=document.querySelector('[data-testid="research-evidence-fusion"] [data-testid="fusion-status"]');
   return element?.getAttribute('data-decision')==='HOLD' &&
     element?.textContent?.includes('معلّق')===true;
  },null,{timeout:8000});
 const arStatus=await fusion.getByTestId('fusion-status').textContent();
 assert(String(arStatus).includes('معلّق') &&
   await fusion.getByTestId('fusion-status').getAttribute('data-decision')==='HOLD',
   'D04 Arabic status must display Arabic hold while preserving immutable machine HOLD; actual='+JSON.stringify(arStatus));
 assert(errors.length===0,'React browser failures: '+errors.slice(0,2).join(','));
 console.log('D06_D07_REAL_CHROMIUM=PASS financial_and_valuation_states_separate=true inferred_title=false');
}catch(e){console.error('D06_D07_REAL_CHROMIUM=FAIL '+String(e.stack||e));process.exitCode=1;}
finally{if(browser)await browser.close();if(server)await server.httpServer.close();}

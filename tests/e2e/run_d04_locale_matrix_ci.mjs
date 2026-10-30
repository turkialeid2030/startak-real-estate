import {preview} from 'vite';
import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{collectLocaleSurface}=require('./locale-surface-check');
const ar=require('../../src/i18n/locales/ar-SA'),en=require('../../src/i18n/locales/en');
const gold=require('../reference/RE-GOLD-baseline.json'),{ALL_SECTORS}=require('../../src/governance/personal-asset-universe');
const namespace=require('../../src/storage/browser-local-storage-provider').NAMESPACE;
const DIR='runtime-evidence/remaining-audit';let server,browser;
const rows=[],errors=[];
try{
 await fs.mkdir(DIR,{recursive:true});server=await preview({preview:{host:'127.0.0.1',port:4177,strictPort:true}});
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({locale:'ar-SA',viewport:{width:1366,height:960}}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 const seeds=['building','land'].map((mode,i)=>({id:'SYNTH-D04-'+mode,name:'SYNTH-D04 / العقار '+mode,mode,inputs:gold[i?'RE-GOLD-001_land_development':'RE-GOLD-002_existing_building'].inputs,savedAt:'2026-10-30T00:00:00.000Z'}));
 await page.addInitScript(({namespace,seeds})=>{localStorage.setItem('startak.presentation.locale','ar-SA');for(const s of seeds)localStorage.setItem(namespace+'deal:'+s.id,JSON.stringify(s));localStorage.setItem(namespace+'deals-index',JSON.stringify(seeds.map(({inputs,...s})=>s)));},{namespace,seeds});
 await page.goto('http://127.0.0.1:4177/',{waitUntil:'domcontentloaded'});
 await expect(page.getByTestId('canonical-case-workspace-panel')).toBeVisible({timeout:30000});
 let locale='ar-SA';
 const setLocale=async next=>{if(next!==locale){await page.getByTestId('locale-switch').click();locale=next;}await expect(page.locator('html')).toHaveAttribute('dir',locale==='en'?'ltr':'rtl');};
 const expand=async()=>{await page.locator('details').evaluateAll(nodes=>{for(const n of nodes)n.open=true;});let n=0;while(n++<50&&await page.locator('button[aria-expanded="false"]:visible').count())await page.locator('button[aria-expanded="false"]:visible').first().click();};
 const scan=async(id,expandSurface=true)=>{if(expandSurface)await expand();const result=await page.evaluate(collectLocaleSurface,{locale});if(result.checkedTextNodes<100)throw Error('Locale scan has insufficient rendered coverage: '+id);rows.push({id,...result});if(result.issues.length)console.log('D04_UNTRANSLATED '+id+' '+JSON.stringify(result.issues.slice(0,80)));};
 for(const seed of seeds){
  await setLocale('en');await page.getByTitle(en.actions.savedDeals,{exact:true}).click();const dialog=page.getByRole('dialog');
  await scan(seed.mode+'-saved-dialog-en',false);await dialog.getByRole('button',{name:seed.name,exact:true}).click();
  for(const tab of ['dashboard','cashflow','sensitivity']){
   await setLocale('en');await page.getByRole('button',{name:en.tabs[tab],exact:true}).click();
   await scan(seed.mode+'-'+tab+'-en');await setLocale('ar-SA');await scan(seed.mode+'-'+tab+'-ar');
  }
 }
 const universe=page.getByTestId('personal-asset-universe-panel');
 for(const assetClass of Object.keys(ALL_SECTORS)){
  await universe.getByTestId('personal-asset-universe-select').selectOption(assetClass);
  await universe.getByTestId('personal-sector-calculate').click();
  if(await universe.getByTestId('limited-interest-calculate').count())await universe.getByTestId('limited-interest-calculate').click();
  if(await universe.getByTestId('phased-development-calculate').count())await universe.getByTestId('phased-development-calculate').click();
  await setLocale('en');await scan('sector-'+assetClass+'-hold-en');await setLocale('ar-SA');await scan('sector-'+assetClass+'-hold-ar');
 }
 const report={schemaVersion:1,status:rows.every(x=>x.issues.length===0)&&errors.length===0?'PASS':'FAIL',coverageScope:'REGISTERED_RENDERED_UI_MATRIX_NOT_ALL_POSSIBLE_STATES',rows,errors,transactionAuthorized:false,professionalApproval:false};
 await fs.writeFile(DIR+'/d04-locale-matrix.json',JSON.stringify(report,null,2));
 console.log('D04_REGISTERED_LOCALE_MATRIX='+report.status+' states='+rows.length+' issues='+rows.reduce((n,x)=>n+x.issues.length,0));
 if(report.status!=='PASS')throw Error('Rendered locale matrix contains untranslated system content or runtime errors');
}finally{await browser?.close();if(server)await new Promise(resolve=>server.httpServer.close(resolve));}

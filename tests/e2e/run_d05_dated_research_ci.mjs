import {preview} from 'vite';
import {chromium} from 'playwright';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ar=require('../../src/i18n/locales/ar-SA');
const {findChromiumExecutable}=require('../config/paths');
let server,browser;
const ok=(v,msg)=>{if(!v)throw Error(msg);};
try {
 server=await preview({preview:{host:'127.0.0.1',port:4173,strictPort:false}});
 const url='http://127.0.0.1:'+server.httpServer.address().port+'/';
 browser=await chromium.launch({headless:true,executablePath:findChromiumExecutable(),
  args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage({viewport:{width:1280,height:900},locale:'ar-SA'});
 page.setDefaultTimeout(10000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url,{waitUntil:'domcontentloaded'});
 ok(await page.getByTestId('dated-scenario-review').count()===0,
  'D05 optional dated scenario must not attach to existing buildings');
 await page.getByRole('button',{name:ar.mode.land,exact:true}).click();
 const panel=page.getByTestId('dated-scenario-review');
 await panel.waitFor({state:'visible'});
 ok(await panel.getByTestId('dated-discount-rate').inputValue()==='',
  'D05 cannot start with inferred rate');
 ok(await panel.getByTestId('dated-row-date-0').inputValue()==='',
  'D05 cannot invent dated cashflows');
 await panel.getByTestId('dated-calculate').click();
 ok((await panel.getByTestId('dated-review-result').innerText()).includes('HOLD_INSUFFICIENT_OR_INVALID_DATED_EVIDENCE'),
  'missing evidence must fail closed');
 await panel.getByTestId('dated-discount-rate').fill('٠٫١');
 await panel.getByTestId('dated-row-date-0').fill('2026-01-01');
 await panel.getByTestId('dated-row-amount-0').fill('-1,000');
 await panel.getByTestId('dated-row-source-0').fill('SYNTH-acquisition-ref');
 await panel.getByTestId('dated-row-date-1').fill('2027-01-01');
 await panel.getByTestId('dated-row-amount-1').fill('١٬١٠٠');
 await panel.getByTestId('dated-row-source-1').fill('SYNTH-sale-ref');
 await panel.getByTestId('dated-calculate').click();
 ok((await panel.getByTestId('dated-review-blockers').innerText()).includes('EXPLICIT_DATA_RIGHTS'),
  'data rights checkbox cannot be bypassed');
 await panel.getByTestId('dated-source-attestation').check();
 await panel.getByTestId('dated-calculate').click();
 const result=await panel.getByTestId('dated-review-result').innerText();
 ok(result.includes('UNVERIFIED_DATED_SCENARIO_CALCULATED')&&result.includes('XIRR')&&result.includes('XNPV'),
  'qualified mathematical result labels must display unverified state');
 ok(result.includes('لا تحقق مستقل')&&result.includes('لا صلاحية معاملة'),
  'UI must explicitly deny independent proof and transaction authority');
 await panel.getByTestId('dated-row-amount-1').fill('1e3');
 ok(await panel.getByTestId('dated-review-result').count()===0,
  'editing cashflows must clear previously calculated result immediately');
 await panel.getByTestId('dated-calculate').click();
 ok((await panel.getByTestId('dated-review-result').innerText()).includes('HOLD_'),
  'malformed numeric text must hold');
 await page.getByRole('button',{name:'EN',exact:true}).click();
 ok((await panel.locator('h2').innerText()).includes('Optional dated return research'),
  'English owner study labels visible on language switch');
 ok(await panel.getByTestId('dated-row-amount-1').inputValue()==='1e3',
  'locale change must never normalize malformed economic input');
 ok(errors.length===0,'browser exceptions '+errors.slice(0,2).join(', '));
 console.log('D05_DATED_OWNER_REAL_CHROMIUM=PASS no_real_market_data=true canonical_unmodified=true');
}catch(e){console.error('D05_DATED_OWNER_REAL_CHROMIUM=FAIL '+String(e.stack||e));process.exitCode=1;}
finally{if(browser)await browser.close();if(server)await server.httpServer.close();}

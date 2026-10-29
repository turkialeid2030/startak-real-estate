import {preview} from 'vite';
import {chromium} from 'playwright';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
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
 ok((await panel.getByTestId('dated-day-count').innerText()).includes('ACT/365.2425'),
  'D05 day count must be visible');
 await panel.getByTestId('dated-reconcile-amounts').check();
 ok(await panel.getByTestId('dated-review-result').count()===0,
  'changing reference policy invalidates prior standalone result');
 await panel.getByTestId('dated-calculate').click();
 ok((await panel.getByTestId('dated-review-blockers').innerText()).includes('CANONICAL_PERIOD_MAPPING_REQUIRED'),
  'annual reference period cannot be inferred');
 const periodCount=await panel.getByTestId('dated-row-period-0').locator('option').count();
 ok(periodCount>2,'current project cashflows appear only as explicit reference options');
 await panel.getByTestId('dated-check-period-dates').check();
 ok(await panel.getByTestId('dated-window-start-0').inputValue()===''&&
   await panel.getByTestId('dated-window-end-0').inputValue()==='',
  'D05 never infers period dates from numeric annual or monthly indices');
 await panel.getByTestId('dated-window-start-0').fill('2026-01-01');
 await panel.getByTestId('dated-window-end-0').fill('2026-01-01');
 await panel.getByTestId('dated-window-source-0').fill('SYNTH/time-zero-source');
 await panel.getByTestId('dated-row-period-0').selectOption('0');
 await panel.getByTestId('dated-row-period-1').selectOption('1');
 await panel.getByTestId('dated-calculate').click();
 ok((await panel.getByTestId('dated-review-result').innerText()).includes('HOLD_'),
  'unrelated sourced cashflows cannot pass amount reconciliation');
 await panel.getByTestId('dated-reconcile-amounts').uncheck();
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
 await panel.getByTestId('dated-reconcile-amounts').check();
 ok(await panel.getByTestId('dated-window-start-0').inputValue()==='2026-01-01'&&
   await panel.getByTestId('dated-window-source-0').inputValue()==='SYNTH/time-zero-source',
  'language switch preserves explicit user period evidence');
 await panel.getByTestId('dated-reference-basis').selectOption('EQUITY');
 ok(!await panel.getByTestId('dated-check-period-dates').isChecked(),
  'switching project/equity reference clears timing attestation and windows');
 await panel.getByTestId('dated-check-period-dates').check();
 ok(await panel.getByTestId('dated-window-start-0').inputValue()==='',
  'dates from a different financial basis cannot be reused automatically');
 await panel.getByTestId('dated-reconcile-amounts').uncheck();
 await panel.getByTestId('dated-row-amount-1').fill('1100');
 await panel.getByTestId('dated-calculate').click();
 ok((await panel.getByTestId('dated-review-result').innerText()).includes('UNVERIFIED_DATED_SCENARIO_CALCULATED'),
  'a current calculated result exists before changing project economics');
 const timingSection=page.getByRole('button',{name:/Timing and Return/});
 if(await timingSection.getAttribute('aria-expanded')!=='true')await timingSection.click();
 const constructionInput=page.locator('label').filter({hasText:'Construction Period'}).locator('input').first();
 await constructionInput.fill('2.5');
 ok(await panel.getByTestId('dated-row-date-0').inputValue()===''&&
  await panel.getByTestId('dated-row-source-0').inputValue()===''&&
  !await panel.getByTestId('dated-source-attestation').isChecked()&&
  await panel.getByTestId('dated-review-result').count()===0,
  'editing the same project invalidates prior dates, references, consent and results');
 const financingSection=page.getByRole('button',{name:/Real Estate Financing \(Optional\)/});
 if(await financingSection.getAttribute('aria-expanded')!=='true')await financingSection.click();
 const leverage=page.getByRole('switch',{name:'Enable Financial Leverage',exact:true});
 if(await leverage.getAttribute('aria-checked')!=='true')await leverage.click();
 const projection=page.getByTestId('dated-development-projection');
 await projection.locator('summary').first().click();
 ok(await projection.getByTestId('dated-projection-start').inputValue()===''&&
  await projection.getByTestId('dated-projection-income-timing').inputValue()==='',
  'monthly projection cannot infer start date or NOI allocation assumption');
 await projection.getByTestId('dated-projection-calculate').click();
 ok((await projection.getByTestId('dated-projection-blockers').innerText()).includes('EXPLICIT_PROJECTION_ASSUMPTIONS_REQUIRED'),
  'no illustrative projection without explicit assumption confirmation');
 await projection.getByTestId('dated-projection-start').fill('2026-01-31');
 await projection.getByTestId('dated-projection-source').fill('SYNTH/EXECUTION-PLAN');
 await projection.getByTestId('dated-projection-confirm').check();
 await projection.getByTestId('dated-projection-calculate').click();
 ok((await projection.getByTestId('dated-projection-blockers').innerText()).includes('EXPLICIT_INCOME_TIMING_REQUIRED'),
  'NOI collection cannot silently default to monthly or annual');
 await projection.getByTestId('dated-projection-income-timing').selectOption('UNIFORM_MONTHLY');
 await projection.getByTestId('dated-projection-calculate').click();
 ok((await projection.getByTestId('dated-projection-calendar').innerText()).includes('2028-07-31'),
  '2.5-year development completes after 30 months, not after rounded 3 years');
 const downloadPromise=page.waitForEvent('download');
 await projection.getByTestId('dated-projection-export').click();
 const download=await downloadPromise;
 const payload=JSON.parse(await readFile(await download.path(),'utf8'));
 ok(payload.inputs.constructionPeriod===2.5&&payload.inputs.leverageEnabled===true,
  'download is bound to the current financed project inputs');
 ok(payload.projection.constructionMonths===30&&payload.projection.canonicalRoundedConstructionYears===3&&
  payload.projection.constructionRows.length===30&&payload.projection.completionDate==='2028-07-31',
  'download contains the full monthly construction timeline');
 ok(payload.projection.accounting.canonicalMonthlyFinancingAmountsMatched===true&&
  payload.projection.accounting.projectAndEquityCashflowsReconciled===true,
  'current monthly facility amounts and dated project/equity accounting agree');
 ok(!payload.projection.canonicalReturnsChanged&&!payload.projection.independentlyVerified&&
  !payload.projection.transactionAuthorized&&!payload.projection.professionalValuationAuthorized,
  'projection export cannot confer verification, investment approval or alter annual economics');
 await projection.getByTestId('dated-projection-income-timing').selectOption('ANNUAL_END');
 ok(await projection.getByTestId('dated-projection-result').count()===0,'changing assumed receipt timing clears result');
 await page.getByTestId('locale-switch').click();
 ok(await projection.getAttribute('dir')==='rtl'&&
  await projection.getByTestId('dated-projection-start').inputValue()==='2026-01-31'&&
  await projection.getByTestId('dated-projection-income-timing').inputValue()==='ANNUAL_END',
  'Arabic presentation preserves explicitly chosen projection assumptions');
 await projection.getByTestId('dated-projection-calculate').click();
 ok(await projection.getByTestId('dated-projection-calendar').count()===1,'Arabic monthly projection calculates');
 await page.locator('label').filter({hasText:ar.inputLand.constructionPeriod}).locator('input').first().fill('2');
 ok(await projection.getByTestId('dated-projection-start').inputValue()===''&&
  await projection.getByTestId('dated-projection-result').count()===0,
  'editing actual project inputs invalidates monthly projection and assumptions before display');
 ok(errors.length===0,'browser exceptions '+errors.slice(0,2).join(', '));
 console.log('D05_DATED_OWNER_REAL_CHROMIUM=PASS no_real_market_data=true canonical_unmodified=true');
}catch(e){console.error('D05_DATED_OWNER_REAL_CHROMIUM=FAIL '+String(e.stack||e));process.exitCode=1;}
finally{if(browser)await browser.close();if(server)await server.httpServer.close();}

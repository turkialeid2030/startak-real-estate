'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {chromium,expect}=require('@playwright/test');
const BASE=process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1366,height:960},locale:'ar-SA',acceptDownloads:true});
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  const panel=page.getByTestId('personal-limited-interest-dcf');
  await expect(panel).toBeVisible({timeout:30000});
  await panel.getByTestId('limited-interest-right').selectOption('USUFRUCT');
  await panel.locator('input[type="number"]').fill('5');
  await panel.locator('input[type="date"]').fill('2026-10-25');
  const amounts=['1000000','100000','100000','50000','0','0','0','0.1','100000'];
  for(let i=0;i<amounts.length;i++)await panel.locator('input[type="text"]').nth(i).fill(amounts[i]);
  await panel.locator('input[type="checkbox"]').nth(0).check();
  await panel.locator('input[type="checkbox"]').nth(1).check();
  await panel.getByTestId('limited-interest-calculate').click();
  await expect(panel.getByTestId('limited-interest-result')).toContainText('القيمة الحالية');
  const initial=(await panel.getByTestId('limited-interest-result').innerText()).trim();
  const next=page.waitForEvent('download');
  await panel.getByTestId('limited-interest-export-case').click();
  const download=await next;
  const content=await fs.readFile(await download.path(),'utf8');
  const archive=JSON.parse(content);
  assert.equal(archive.state.right,'USUFRUCT');
  assert.equal(archive.state.term,'5');
  assert.equal(archive.state.inputs.annualPropertyIncomeSar,'1000000');
  assert.equal(Object.hasOwn(archive,'result'),false);
  assert.equal(Object.hasOwn(archive,'purchaseAuthorized'),false);
  assert.equal(archive.sha256.length,64);
  await panel.locator('input[type="text"]').first().fill('2000000');
  await panel.getByTestId('limited-interest-calculate').click();
  const after=(await panel.getByTestId('limited-interest-result').innerText()).trim();
  assert.notEqual(after,initial,'edited input changes calculation');
  await panel.getByTestId('limited-interest-import-case').setInputFiles({
   name:'rights-case.json',mimeType:'application/json',buffer:Buffer.from(content),
  });
  await expect(panel.locator('input[type="text"]').first()).toHaveValue('1000000');
  await expect(panel.getByTestId('limited-interest-result')).toHaveCount(0);
  await expect(panel.getByTestId('limited-interest-archive-status')).toContainText('استُعيدت');
  // Tampered payload must not change current values.
  const modified=JSON.parse(content);
  modified.state.inputs.annualPropertyIncomeSar='1';
  await panel.getByTestId('limited-interest-import-case').setInputFiles({
   name:'tampered.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(modified)),
  });
  await expect(panel.getByTestId('limited-interest-archive-status')).toContainText('رفض');
  await expect(panel.locator('input[type="text"]').first()).toHaveValue('1000000');
  // Wrong-sector archive with an intact digest is still inadmissible.
  const sector=page.getByTestId('personal-asset-universe-select');
  await sector.selectOption('LAND');
  const landPanel=page.getByTestId('personal-limited-interest-dcf');
  await expect(landPanel.locator('input[type="text"]').first()).toHaveValue('');
  await landPanel.getByTestId('limited-interest-import-case').setInputFiles({
   name:'wrong-sector.json',mimeType:'application/json',buffer:Buffer.from(content),
  });
  await expect(landPanel.getByTestId('limited-interest-archive-status')).toContainText('رفض');
  await expect(landPanel.getByTestId('limited-interest-result')).toHaveCount(0);
  assert.deepEqual(errors,[],'no browser exceptions during input/calc/restore');
  console.log('LIMITED_RIGHTS_REAL_BROWSER_ARCHIVE=PASS cases=restore,corruption,sector,isolation');
 }finally{await context.close();await browser.close();}
})().catch(e=>{console.error('LIMITED_RIGHTS_REAL_BROWSER_ARCHIVE=FAIL',e);process.exitCode=1;});

'use strict';
// A real native Vite process, real Chromium and a real React source file edit.
// Never grants appraisal, market source rights, transaction authority or LLM.
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');
const URL='http://127.0.0.1:4175/';
const filename=path.join(__dirname,'../../src/components/PersonalAssetUniversePanel.jsx');
const before='دليل جميع الفئات العقارية — بحث شخصي';
const after='دليل جميع الفئات العقارية — اختبار تحديث حي';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function startup(output,child){
 let last='';
 for(let attempt=0;attempt<110;attempt++){
  if(child.exitCode!==null)throw Error('NATIVE_BUNDLED_VITE_EXITED: '+output().slice(-1600));
  try{
   const result=await fetch(URL,{signal:AbortSignal.timeout(2500)});
   if(result.ok&&/html/i.test(result.headers.get('content-type')||''))return;
   last='HTTP '+result.status;
  }catch(e){last=e.message;}
  await delay(500);
 }
 throw Error('NATIVE_BUNDLED_VITE_STARTUP_TIMEOUT '+last+' '+output().slice(-900));
}
async function main(){
 const original=fs.readFileSync(filename,'utf8');
 assert(original.includes(before),'actual source heading missing');
 assert(!original.includes(after),'not a clean source fixture');
 let child=null,browser=null,changed=false,logs='',pageErrors=[],consoleErrors=[],requestFailures=[];
 try{
  child=spawn('npm',['run','dev:bundled','--','--host','127.0.0.1','--port','4175','--strictPort'],
   {cwd:path.join(__dirname,'../..'),env:{...process.env,STARTAK_SOURCE_COMMIT:''},
    stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
  for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{logs=(logs+String(chunk)).slice(-16000);});
  await startup(()=>logs,child);
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({locale:'ar-SA',viewport:{width:1360,height:960}});
  const page=await context.newPage();let loads=0;
  page.on('load',()=>loads++);
  page.on('pageerror',e=>pageErrors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  page.on('requestfailed',r=>requestFailures.push((r.url()||'').slice(-100)));
  const response=await page.goto(URL,{waitUntil:'domcontentloaded',timeout:60000});
  assert(response?.ok(),'actual native Vite index HTTP failed');
  const universe=page.getByTestId('personal-asset-universe-panel');
  await expect(universe).toBeVisible({timeout:60000});
  await expect(universe).toHaveAttribute('dir','rtl');
  await expect(universe.locator('h3')).toContainText(before);
  const selector=page.getByTestId('personal-asset-universe-select');
  assert.equal(await selector.locator('option').count(),13,'13 sector choices not rendered');
  await selector.selectOption('LAND');
  await expect(page.getByTestId('personal-phased-development-dcf')).toBeVisible();
  await expect(page.getByTestId('personal-sector-workbench')).toBeVisible();
  const workbench=page.getByTestId('personal-sector-workbench');
  await workbench.getByTestId('personal-sector-calculate').click();
  await expect(workbench.getByTestId('personal-sector-scenario-output')).toContainText('الحساب محجوب');
  await expect(workbench.getByTestId('personal-sector-provisional-value')).toHaveCount(0);
  assert.equal(await page.evaluate(()=>typeof window.require),'undefined','no browser CommonJS global injected');
  // Wait for initial load to complete, then prove React HMR without full reload.
  await page.waitForLoadState('load',{timeout:10000});
  const loadsBefore=loads;
  fs.writeFileSync(filename,original.replace(before,after),'utf8');changed=true;
  await expect(universe.locator('h3')).toContainText(after,{timeout:30000});
  assert.equal(loads,loadsBefore,'native bundled React must update without full navigation');
  await expect(selector).toHaveValue('LAND');
  await expect(workbench.getByTestId('personal-sector-scenario-output')).toContainText('الحساب محجوب');
  fs.writeFileSync(filename,original,'utf8');changed=false;
  await expect(universe.locator('h3')).toContainText(before,{timeout:30000});
  assert.equal(loads,loadsBefore,'restore also must HMR without document reload');
  assert.deepEqual(pageErrors,[],'browser JavaScript errors '+logs.slice(-800));
  assert(!consoleErrors.some(x=>/require is not defined|hotUpdate|environments/i.test(x)),
   'native plugin error '+consoleErrors.join('; ').slice(-800)+' '+logs.slice(-500));
  assert(!requestFailures.some(x=>/src\/main\.jsx|bundledDevClient/.test(x)),
   'essential native module failed');
  console.log('C63_NATIVE_VITE8_BUNDLED_HMR=PASS sectors=13 researchHOLD=true noGlobalRequire=true noFullReload=true');
 }finally{
  if(changed)fs.writeFileSync(filename,original,'utf8');
  if(browser)await browser.close();
  if(child&&child.exitCode===null){
   try{if(process.platform==='win32')child.kill('SIGTERM');else process.kill(-child.pid,'SIGTERM');}catch{child.kill('SIGTERM');}
   await Promise.race([new Promise(resolve=>child.once('exit',resolve)),delay(3000)]);
   if(child.exitCode===null){try{if(process.platform!=='win32')process.kill(-child.pid,'SIGKILL');else child.kill('SIGKILL');}catch{}}
  }
  assert.equal(fs.readFileSync(filename,'utf8'),original,'CI must restore original JSX exactly');
 }
}
main().catch(e=>{console.error('C63_NATIVE_VITE8_BUNDLED_HMR=FAIL',e);process.exitCode=1;});

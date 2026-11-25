'use strict';
// QA01/QA06: discovery and targeted navigation checks, NOT exhaustive functional acceptance.
// Clean synthetic browser contexts; no destructive actions, external navigation or user data.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {chromium,firefox,webkit}=require('playwright');
const {expect}=require('@playwright/test');
const browserName=process.env.STARTAK_BROWSER||'chromium';
const sha=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(process.env.STARTAK_SOURCE_COMMIT&&sha!==process.env.STARTAK_SOURCE_COMMIT)throw Error('SOURCE_SHA_MISMATCH');
const out=path.resolve('runtime-evidence/product-acceptance',browserName);
fs.mkdirSync(out,{recursive:true});
const sourceFiles=cp.execFileSync('git',['ls-files','-z','--','src'],{encoding:'utf8'}).split('\0').filter(p=>/\.(jsx|tsx)$/.test(p));
const source=sourceFiles.map(file=>{
 const text=fs.readFileSync(file,'utf8');
 const line=i=>text.slice(0,i).split('\n').length;
 return {file,nativeCandidates:[...text.matchAll(/<(button|input|select|textarea|a|summary)\b/g)].map(m=>({tag:m[1],line:line(m.index)})),literalTestIds:[...text.matchAll(/data-testid=["']([^"']+)["']/g)].map(m=>({id:m[1],line:line(m.index)})),dynamicTestIdExpressions:(text.match(/data-testid=\{/g)||[]).length,handlerCandidates:[...text.matchAll(/\b(onClick|onChange|onSubmit|onKeyDown|onBlur|onFocus)\s*=/g)].map(m=>({event:m[1],line:line(m.index)}))};
});
fs.writeFileSync(path.join(out,'source-candidates.json'),JSON.stringify({sha,method:'lexical candidates; comments, dynamic rendering and custom components require manual reconciliation',files:source},null,2));
(async()=>{
 const browser=await ({chromium,firefox,webkit}[browserName]).launch({headless:true});
 const records=[],errors=[];let navigationChecks=0;
 try{
 for(const width of [390,768,1366])for(const locale of ['ar-SA','en']){
 const context=await browser.newContext({viewport:{width,height:width===390?844:900},locale,acceptDownloads:false});
 const page=await context.newPage(),pageErrors=[];
 page.on('pageerror',e=>pageErrors.push(String(e)));
 await page.addInitScript(l=>localStorage.setItem('startak.presentation.locale',l),locale);
 const base=new URL(process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173');
 base.search='';base.hash='';
 if(!['localhost','127.0.0.1'].includes(base.hostname))throw Error('LOCAL_SYNTHETIC_PREVIEW_REQUIRED');
 await context.route('**/*',route=>{
  const u=new URL(route.request().url());
  return u.origin===base.origin||['data:','blob:'].includes(u.protocol)?route.continue():route.abort();
 });
 const snapshot=async(state)=>{
 const controls=await page.evaluate(()=>{
  const selector='button,input,select,textarea,a[href],summary,[role="button"],[role="link"],[role="tab"],[role="checkbox"],[role="radio"],[role="switch"],[tabindex],[contenteditable="true"]';
  const normalize=s=>String(s||'').replace(/\s+/g,' ').trim().slice(0,160);
  const rows=[];
  for(const [ordinal,e] of [...document.querySelectorAll(selector)].entries()){
   const css=getComputedStyle(e),rect=e.getBoundingClientRect();
   const visible=!!(e.getClientRects().length&&rect.width&&rect.height&&css.visibility!=='hidden'&&css.visibility!=='collapse'&&!e.closest('[hidden],[inert]'));
   const referenced=(e.getAttribute('aria-labelledby')||'').split(/\s+/).filter(Boolean).map(id=>document.getElementById(id)?.textContent||'').join(' ');
   const labels=[...(e.labels||[])].map(l=>l.textContent).join(' ');
   const safeText=e.closest('[data-user-content]')?'':(['BUTTON','A','SUMMARY'].includes(e.tagName)||e.getAttribute('role')==='button'?e.textContent:'');
   const labelCandidate=normalize(referenced||e.getAttribute('aria-label')||labels||safeText||e.getAttribute('title'));
   rows.push({ordinal,tag:e.tagName.toLowerCase(),role:e.getAttribute('role'),type:e.getAttribute('type'),testId:e.getAttribute('data-testid'),parentTestId:e.parentElement?.closest('[data-testid]')?.getAttribute('data-testid')||null,labelCandidate,visible,disabled:e.matches(':disabled')||e.getAttribute('aria-disabled')==='true',ariaHidden:!!e.closest('[aria-hidden="true"]'),tabIndex:e.tabIndex,width:Math.round(rect.width),height:Math.round(rect.height),horizontalOverflowCandidate:visible&&(rect.left< -1||rect.right>innerWidth+1)});
  }
  return rows;
 });
 const visible=controls.filter(c=>c.visible);
 const ids=visible.map(c=>c.testId).filter(Boolean);
 records.push({browser:browserName,locale,width,state,controls,summary:{rendered:controls.length,visible:visible.length,visibleWithoutLabelCandidate:visible.filter(c=>!c.labelCandidate).length,visibleWithoutTestId:visible.filter(c=>!c.testId).length,duplicateVisibleTestIds:[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))],horizontalOverflowCandidates:visible.filter(c=>c.horizontalOverflowCandidate).length},disposition:'DISCOVERED_NOT_FUNCTIONALLY_ACCEPTED'});
 };
 await page.goto(base.href);
 await expect(page.getByTestId('startak-owner-wizard')).toBeVisible();navigationChecks++;
 for(const mode of ['building','land']){
  if(mode==='land'){
   await page.getByTestId('owner-advanced-mode').click();
   await page.getByTestId('study-mode-land').click();
   await expect(page.getByTestId('study-mode-land')).toHaveAttribute('aria-pressed','true');navigationChecks++;
   await page.getByTestId('owner-simple-mode').click();
  }
  for(let step=0;step<5;step++){
   const button=page.getByTestId('owner-step-'+step);
   await button.click();
   await expect(button).toHaveAttribute('aria-current','step');
   await expect(button).toHaveAttribute('aria-label',/\S/);navigationChecks+=2;
   await snapshot('simple:'+mode+':step-'+step);
  }
  await page.screenshot({path:path.join(out,locale+'-'+width+'-'+mode+'-simple.png'),fullPage:false});
  await page.getByTestId('owner-advanced-mode').click();
  await expect(page.getByTestId('study-mode-'+mode)).toHaveAttribute('aria-pressed','true');navigationChecks++;
  for(const tab of ['dashboard','cashflow','sensitivity']){
   const button=page.getByTestId('financial-tab-'+tab);
   await button.click();await expect(button).toHaveAttribute('aria-pressed','true');
   await expect(page.locator('[data-testid^="financial-tab-"][aria-pressed="true"]')).toHaveCount(1);navigationChecks+=2;
   await snapshot('advanced:'+mode+':'+tab);
  }
  await page.getByTestId('financial-tab-dashboard').click();
  await page.screenshot({path:path.join(out,locale+'-'+width+'-'+mode+'-advanced.png'),fullPage:false});
  const dict=locale==='en'?require('../../src/i18n/locales/en'):require('../../src/i18n/locales/ar-SA');
  await page.getByTitle(dict.actions.savedDeals,{exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();navigationChecks++;
  await snapshot('advanced:'+mode+':saved-deals-dialog');
  await page.getByRole('dialog').press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);navigationChecks++;
  await page.getByTestId('owner-simple-mode').click();
 }
 errors.push(...pageErrors.map(error=>({locale,width,error})));
 await context.close();
 }
 }finally{
 await browser.close();
 fs.writeFileSync(path.join(out,'runtime-inventory.json'),JSON.stringify({sha,browser:browserName,navigationChecks,records,errors,scope:'synthetic empty-state navigation; not all conditional states, roles, actions or accessibility names'},null,2));
 }
 if(errors.length)throw Error('PAGE_ERRORS '+errors.length);
 if(records.length!==108)throw Error('INCOMPLETE_CENSUS '+records.length);
 console.log('PRODUCT_CONTROL_CENSUS=PASS sha='+sha+' browser='+browserName+' states='+records.length+' navigationChecks='+navigationChecks+' functionalCoverageNotEstablished=true');
})().catch(e=>{console.error(e);process.exitCode=1;});

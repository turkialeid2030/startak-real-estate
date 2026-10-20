'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),{createHash}=require('node:crypto');
const {chromium,firefox,webkit,expect}=require('@playwright/test');
const {pngTextFixture,imagePdfFixture}=require('../fixtures/local-ocr-page');
let BASE=(process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
let closePreview,localTlsPreview=false;
const DIR='runtime-evidence/remaining-audit';let checks=0;
const ok=(v,label)=>{assert.ok(v,label);checks++;};
async function download(page,locator){const pending=page.waitForEvent('download');await locator.click();const file=await pending;return JSON.parse(await fs.readFile(await file.path(),'utf8'));}
async function secureLoopbackPreview(){
 const upstream=new URL(BASE);if(upstream.protocol==='https:')return;
 if(upstream.protocol!=='http:'||!['127.0.0.1','localhost'].includes(upstream.hostname))throw Error('OCR acceptance requires HTTPS or a loopback preview');
 // WebKit upgrades loopback subresources under the unchanged production CSP.
 // Supply real local TLS instead of removing upgrade-insecure-requests.
 const dir=await fs.mkdtemp(require('node:path').join(require('node:os').tmpdir(),'startak-ocr-tls-'));
 let server;
 try{
  const key=dir+'/key.pem',cert=dir+'/cert.pem';
  require('node:child_process').execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1,DNS:localhost'],{stdio:'ignore'});
  server=require('node:https').createServer({key:await fs.readFile(key),cert:await fs.readFile(cert)},(req,res)=>{
   const request=require('node:http').request({hostname:upstream.hostname,port:upstream.port||80,path:req.url,method:req.method,headers:{...req.headers,host:upstream.host}},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res);});
   request.setTimeout(20000,()=>request.destroy(Error('Loopback preview timeout')));
   request.on('error',()=>{if(!res.headersSent){res.writeHead(502);res.end('Loopback preview failed');}else res.destroy();});req.pipe(request);
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  BASE='https://127.0.0.1:'+server.address().port;localTlsPreview=true;
  closePreview=async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await fs.rm(dir,{recursive:true,force:true});};
 }catch(error){server?.closeAllConnections();server?.close();await fs.rm(dir,{recursive:true,force:true});throw error;}
}
(async()=>{
 await fs.mkdir(DIR,{recursive:true});await secureLoopbackPreview();const evidence=[];
 const header=(await fs.readFile('public/_headers','utf8')).split('\n').find(l=>l.includes('Content-Security-Policy:')).trim().slice('Content-Security-Policy:'.length).trim();
 for(const[name,engine]of Object.entries({chromium,firefox,webkit})){
  const browser=await engine.launch({headless:true,...(name==='chromium'?{args:['--no-sandbox']}: {})});
  try{for(const width of [1366,390]){
   const context=await browser.newContext({viewport:{width,height:960},locale:'ar-SA',acceptDownloads:true,reducedMotion:'reduce',ignoreHTTPSErrors:localTlsPreview});
   await context.addInitScript(()=>{
    localStorage.setItem('startak.locale','ar-SA');
    const OriginalWorker=window.Worker;window.__ocrWorkers={created:0,terminated:0};
    window.Worker=class extends OriginalWorker{constructor(url,options){super(url,options);this.ocr=String(url).includes('/assets/ocr/');if(this.ocr)window.__ocrWorkers.created++;}terminate(){if(this.ocr){window.__ocrWorkers.terminated++;this.ocr=false;}super.terminate();}};
   });
   const page=await context.newPage(),errors=[],external=[],violations=[],resources=[],failedRequests=[],consoleErrors=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText}));
   page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
   page.on('request',r=>{if(!r.url().startsWith(BASE)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push({url:r.url(),method:r.method()});if(r.url().includes('/assets/ocr/'))resources.push(r.url());});
   page.on('console',m=>{if(m.type()==='error'&&/Content Security Policy|Refused to|wasm/i.test(m.text()))violations.push(m.text());});
   // Vite preview does not implement Pages headers. Enforce the production
   // policy there; never replace or relax an existing deployed policy.
   let stallWorker=false,resumeWorker,workerBlocked;
   const applyPolicy=async route=>{const response=await route.fetch({ignoreHTTPSErrors:localTlsPreview}),headers=response.headers();
    if(!headers['content-security-policy'])headers['content-security-policy']=header;
    await route.fulfill({response,headers});};
   await context.route(BASE+'/',applyPolicy);
   await context.route(BASE+'/assets/ocr/**',async route=>{
    if(stallWorker&&route.request().url().endsWith('/worker.min.js')){
     await new Promise(resolve=>{resumeWorker=resolve;workerBlocked();});await route.abort();return;
    }
    await applyPolicy(route);
   });
   await page.goto(BASE+'/',{waitUntil:'domcontentloaded'});
   const panel=page.getByTestId('local-document-evidence-intake');
   try{await expect(panel).toBeVisible({timeout:30000});}catch(error){
    await fs.writeFile(`${DIR}/${name}-${width}-startup-failure.json`,JSON.stringify({engine:name,width,errors,external,violations,failedRequests,consoleErrors,body:await page.locator('body').innerText()},null,2));
    await page.screenshot({path:`${DIR}/${name}-${width}-startup-failure.png`});throw error;
   }
   ok(resources.length===0,'OCR model/worker assets do not load on initial page view');
   await page.getByTestId('document-case-id').fill('SYNTHETIC-OCR-'+name+'-'+width);
   const file=page.getByTestId('local-document-file-input');
   const upload=async(name,mimeType,buffer)=>{await file.setInputFiles({name,mimeType,buffer});await expect(page.getByTestId('local-ocr-controls')).toBeVisible({timeout:15000});};
   await upload('synthetic.png','image/png',pngTextFixture());
   await expect(page.getByTestId('local-ocr-layout').getByRole('radio',{name:'تلقائي',exact:true})).toBeChecked();checks++;
   await expect(page.getByTestId('local-document-parser-reason')).toHaveAttribute('data-parser-reason','IMAGE_OCR_NOT_RUN');checks++;
   await page.getByTestId('local-ocr-start').click();await expect(page.getByTestId('local-document-parser-status')).toHaveAttribute('data-parser-status','PARSED',{timeout:65000});checks++;
   const extracted=await download(page,page.getByTestId('local-ocr-export'));
   ok(extracted.intakeRecord.result.atoms.some(a=>a.rawValue.includes('1234.50')),'actual OCR retains clean synthetic decimal');
   ok(extracted.intakeRecord.digest===createHash('sha256').update(pngTextFixture()).digest('hex'),'OCR source digest is the uploaded image bytes');
   ok(extracted.financialInputEligible===false&&extracted.independentlyVerified===false&&!extracted.sourceImageIncluded,'OCR export never claims financial eligibility/source verification');
   ok(extracted.intakeRecord.result.atoms.every(a=>a.location.page===1&&a.metadata.pixelBounds&&a.metadata.confidenceIsAccuracy===false),'every OCR line retains page, bounds and confidence semantics');
   await page.getByTestId('evidence-atom-select').selectOption({index:1});await page.getByTestId('semantic-key-input').fill('synthetic.source.text');
   await page.getByTestId('source-reference-input').fill('Synthetic original page');await page.getByTestId('reviewer-reference-input').fill('SYNTHETIC-REVIEWER');await page.getByTestId('reviewer-note-input').fill('Selected extracted text; not independently verified');
   await page.getByTestId('create-evidence-candidate').click();await expect(page.getByTestId('candidate-truth-status')).toBeVisible();checks++;
   await page.getByTestId('save-evidence-journal').click();await expect(page.getByTestId('saved-evidence-journal')).toBeVisible();
   const journal=await download(page,page.getByTestId('export-evidence-journal')),candidate=journal.payload.candidate;
   ok(candidate.financialEngineEligible===false&&!candidate.verifiedFactEstablished,'OCR semantic mapping remains an unverified candidate');
   const firstAtom=extracted.intakeRecord.result.atoms[0];ok(candidate.fact.sourceLocator.pixelBounds.x0===firstAtom.metadata.pixelBounds.x0&&candidate.fact.extraction.confidence===firstAtom.metadata.engineConfidence/100,'source journal preserves original pixel coordinates and actual extraction confidence');
   ok(extracted.intakeRecord.result.atoms.every(a=>a.metadata.layout==='AUTO'),'default image extraction records automatic layout');
   await expect(page.getByTestId('local-ocr-source-preview').locator('img')).toBeVisible();checks++;
   await expect(page.getByTestId('local-evidence-workflow-status')).toHaveAttribute('data-verification-status','VERIFICATION_NOT_COMPLETE');checks++;
   // Test real Arabic pixels and a scanned two-page PDF, not a hidden text layer.
   const images=await page.evaluate(()=>{
    return ['PAGE ONE 1234.50 SAR','PAGE TWO 3456.70 SAR'].map(text=>{const c=document.createElement('canvas');c.width=1500;c.height=450;
     const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';x.textAlign='center';x.font='72px Arial';x.direction='rtl';x.fillText('العقار التجريبي',750,140);x.direction='ltr';x.fillText(text,750,310);
     return c.toDataURL('image/jpeg',.98).split(',')[1];});
   });
   const pdf=imagePdfFixture(images.map(base64=>({bytes:Buffer.from(base64,'base64'),width:1500,height:450})));
   await upload('synthetic-scanned.pdf','application/pdf',pdf);
   await expect(page.getByTestId('local-document-parser-reason')).toHaveAttribute('data-parser-reason','PDF_NO_EXTRACTABLE_TEXT');checks++;
   await page.getByTestId('local-ocr-page').fill('٢');await page.getByTestId('local-ocr-layout').getByRole('radio',{name:'كتلة نص واحدة',exact:true}).check();await page.getByTestId('local-ocr-start').click();
   await expect(page.getByTestId('local-document-parser-status')).toHaveAttribute('data-parser-status','PARSED',{timeout:65000});checks++;
   const scanned=await download(page,page.getByTestId('local-ocr-export')),text=scanned.intakeRecord.result.atoms.map(a=>a.rawValue).join('\n');
   await fs.writeFile(`${DIR}/${name}-${width}-ocr-extract.json`,JSON.stringify(scanned,null,2));
   await fs.writeFile(`${DIR}/${name}-${width}-ocr-source.pdf`,pdf);
   const rasterUrl=await page.getByTestId('local-ocr-source-preview').locator('img').getAttribute('src');
   await fs.writeFile(`${DIR}/${name}-${width}-ocr-raster.png`,Buffer.from(rasterUrl.split(',')[1],'base64'));
   await panel.screenshot({path:`${DIR}/${name}-${width}-local-ocr.png`});
   ok(text.includes('3456.70')&&!text.includes('1234.50'),'only selected scanned page two is recognized');
   ok(/[\u0600-\u06ff]{3}/.test(text),'real Arabic image pixels produce Arabic OCR characters; engine='+name+' width='+width+' observed '+JSON.stringify(text));
   ok(scanned.intakeRecord.result.atoms.every(a=>a.metadata.layout==='SINGLE_BLOCK'),'explicit single-block layout survives export');
   ok(scanned.intakeRecord.result.atoms.every(a=>a.location.page===2&&!a.metadata.fullDocumentCovered),'selected PDF page numbers retained without whole-document coverage');
   ok(scanned.intakeRecord.digest===createHash('sha256').update(pdf).digest('hex'),'raster output remains bound to original PDF hash');
   ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'OCR controls and preview fit the viewport');
   const blockChoice=page.getByTestId('local-ocr-layout').getByRole('radio',{name:'كتلة نص واحدة',exact:true});
   await blockChoice.focus();await page.keyboard.press('ArrowLeft');
   await expect(page.getByTestId('local-ocr-layout').getByRole('radio',{name:'تلقائي',exact:true})).toBeChecked();checks++;
   await expect(page.getByTestId('local-ocr-export')).toHaveCount(0);await expect(page.getByTestId('local-ocr-source-preview')).toHaveCount(0);await expect(page.getByTestId('local-document-parser-status')).toHaveCount(0);checks+=3;
   await page.getByTestId('local-ocr-page').fill('3');await page.getByTestId('local-ocr-start').click();
   await expect(panel.getByRole('alert')).toContainText('OCR_PAGE_INVALID',{timeout:15000});await expect(page.getByTestId('local-ocr-export')).toHaveCount(0);await expect(page.getByTestId('local-ocr-source-preview')).toHaveCount(0);checks+=3;
   await page.getByTestId('local-ocr-page').fill('1');await page.getByTestId('local-ocr-start').click();
   await expect(page.getByTestId('local-ocr-busy')).toBeVisible();await panel.getByRole('button',{name:'إلغاء المعالجة',exact:true}).click();
   await expect(page.getByTestId('local-ocr-controls')).toHaveCount(0);await expect(page.getByTestId('local-document-parser-status')).toHaveCount(0);checks+=2;
   // Replacing the case during real model initialization must stop its worker
   // and withhold late results, source previews and semantic candidates.
   let blockedResolve;const blocked=new Promise(resolve=>{blockedResolve=resolve;});workerBlocked=blockedResolve;stallWorker=true;
   await upload('synthetic.png','image/png',pngTextFixture());await page.getByTestId('local-ocr-start').click();
   let blockTimer;try{await Promise.race([blocked,new Promise((_,reject)=>{blockTimer=setTimeout(()=>reject(Error('OCR worker initialization was not observed')),15000);})]);}finally{clearTimeout(blockTimer);}
   await page.waitForFunction(()=>window.__ocrWorkers.created>window.__ocrWorkers.terminated,null,{timeout:15000});
   await page.getByTestId('document-case-id').fill('REPLACEMENT-CASE');
   await expect(page.getByTestId('local-ocr-controls')).toHaveCount(0);await expect(page.getByTestId('local-ocr-export')).toHaveCount(0);checks+=2;
   await page.waitForFunction(()=>window.__ocrWorkers.created===window.__ocrWorkers.terminated,null,{timeout:15000});resumeWorker();stallWorker=false;
   const workers=await page.evaluate(()=>window.__ocrWorkers);ok(workers.created>=3&&workers.created===workers.terminated,'all owned workers terminate, including initialization cancellation');
   ok(await page.getByTestId('local-ocr-layout').count()===0,'replacing a case clears OCR layout controls');
   ok(resources.length>0&&resources.every(url=>url.startsWith(BASE+'/assets/ocr/')),'engine resources remain same-origin');
   ok(external.length===0,'OCR performs no external request or document upload');ok(violations.length===0,'real OCR runs under production CSP: '+violations.join(' | '));ok(errors.length===0,'no browser runtime errors: '+errors.join(' | '));
   evidence.push({engine:name,width,checksCompleted:checks,workers,externalRequests:external,policyViolations:violations,physicalDevice:false});
   await context.close();
  }}finally{await browser.close();}
 }
 await fs.writeFile(DIR+'/local-ocr-acceptance.json',JSON.stringify({sourceCommit:process.env.STARTAK_SOURCE_COMMIT||null,checks,browsers:evidence,independentAccuracyQualified:false,sourceAuthenticationQualified:false},null,2));
 console.log(`LOCAL_OCR_BROWSER=PASS checks=${checks}`);
})().catch(async error=>{console.error(error);await fs.mkdir(DIR,{recursive:true});await fs.writeFile(DIR+'/local-ocr-failure.json',JSON.stringify({checksCompleted:checks,error:error.message},null,2));process.exitCode=1;}).finally(async()=>{await closePreview?.();});

'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const React=require('react'),{JSDOM}=require('jsdom'),{createRoot}=require('react-dom/client'),{Simulate}=require('react-dom/test-utils'),{webcrypto}=require('node:crypto');
const {ASSET_CLASS}=require('../../src/project-model/project-profile');
const {REASONS}=require('../../src/valuation-intelligence/personal-sector-reason-labels');
const {SECTOR_EN,READINESS,DCF_REASONS,DCF_FIELDS,ENUMS,researchReason,researchEnumLabel}=require('../../src/i18n/personal-research-presentation');
const {createPersonalSectorCaseArchive}=require('../../src/valuation-intelligence/personal-sector-case-archive');
const {calculatePersonalSectorCase,buildPersonalSectorResearchReport,verifyPersonalSectorResearchReport,renderPersonalSectorResearchHtml}=require('../../src/valuation-intelligence/personal-sector-research-report');
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;};
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {resolve,reject,promise};};
const bytes=text=>new TextEncoder().encode(text).buffer;
const fixture=(assetClass='OFFICE',city='الرياض-SYNTH')=>({assetClass,
 subject:{city,district:'الملقا-SYNTH',subtype:'نوع <svg onload=alert(1)>',date:'2026-10-30',area:'١٠٠٠',right:'FREEHOLD'},
 methods:{income:assetClass==='LAND',cost:assetClass!=='LAND',market:false},
 inc:{gross:'١٠٠٠٠٠٠',opex:'٢٠٠٠٠٠',cap:'٠٫٠٨',expenseTreatment:'ACTUAL_LANDLORD_OPEX',realEstateOnly:true,groundLease:true,sharedCosts:true},
 cost:{land:'٤٠٠٠٠٠٠',replacement:'٨٠٠٠٠٠٠',depreciation:'٠٫٢٥',excludesBusiness:true},
 comparables:[1,2,3].map(i=>({id:'SYNTH-'+i,city:'الرياض',district:'الملقا',subtype:'مكاتب',right:'FREEHOLD',date:'2026-09-01',unitValue:'١٠٠٠٠',source:'<img src=x onerror=alert(2)>',unit:'SQM',saleKind:i===3?'ASKING_SALE':'EXECUTED_SALE'})),
 marketOptions:{unit:'SQM',quantity:'',businessExcluded:true,mixedAllocated:true},
 policy:{maxDispersion:'٠٫٢',incomeWeight:'٠٫٤',costWeight:'٠٫٣',marketWeight:'٠٫٣'},
});
(async()=>{
 for(const code of Object.keys(REASONS)){
  ok(Boolean(SECTOR_EN[code]),'Every sector HOLD reason has an explicit English explanation: '+code);
  ok(researchReason(code,'ar-SA').message===REASONS[code],'Arabic meaning preserved: '+code);
 }
 for(const code of [...Object.keys(READINESS),...Object.keys(DCF_REASONS)])for(const locale of ['ar-SA','en']){
  const d=researchReason(code,locale);ok(d.code===code&&d.message!==code,'Human explanation retains exact diagnostic code: '+code);
  ok(locale==='en'?!/[\u0600-\u06ff]/.test(d.message):/[\u0600-\u06ff]/.test(d.message),'Reason locale: '+locale+' '+code);
 }
 for(const field of Object.keys(DCF_FIELDS))for(const prefix of ['INVALID_AMOUNT_','INVALID_ESCALATION_']){
  const code=prefix+field,d=researchReason(code,'en');ok(d.code===code&&d.message.includes(DCF_FIELDS[field][1]),'Dynamic error names the readable field: '+code);
 }
 for(const code of Object.keys(ENUMS))for(const locale of ['ar-SA','en'])ok(researchEnumLabel(code,locale)!==code,'Human enum label: '+code+' '+locale);
 for(const key of ['constructor','__proto__','toString'])ok(typeof researchReason(key,'en').message==='string'&&typeof researchEnumLabel(key,'en')==='string','Prototype names cannot become descriptions: '+key);
 ok(researchReason('UNKNOWN_SYNTH','en').code==='UNKNOWN_SYNTH'&&!researchReason('UNKNOWN_SYNTH','en').message.includes('approved'),'Unknown reason preserved without granting authority');
 for(const assetClass of Object.values(ASSET_CLASS)){
  const state=fixture(assetClass),before=JSON.stringify(state),report=buildPersonalSectorResearchReport(state,{generatedAt:'2026-10-30T00:00:00.000Z'}),encoded=JSON.stringify(report);
  for(const locale of ['ar-SA','en']){
   const html=renderPersonalSectorResearchHtml(report,{locale}),doc=new JSDOM(html),body=doc.window.document.body;
   ok(doc.window.document.documentElement.dir===(locale==='en'?'ltr':'rtl'),'Report direction for '+assetClass+' '+locale);
   ok(!body.querySelector('svg,img,script'),'User content cannot execute in report');
   ok([...body.querySelectorAll('[data-user-content]')].some(x=>x.textContent===state.subject.city),'Source city remains original in '+locale);
   ok([...body.querySelectorAll('code')].some(x=>x.textContent===report.result.status),'Stable status code retained');
   ok(body.textContent.includes(researchReason(report.result.reasonCodes[0],locale).message),'Report contains actual human HOLD explanation');
   ok(html.includes(report.inputFingerprintSha256)&&html.includes(report.reportHashSha256),'Both original hashes survive locale selection');
   for(const n of body.querySelectorAll('[data-user-content],code'))n.remove();
   ok(locale==='en'?!/[\u0600-\u06ff]/.test(body.textContent):!/[A-Za-z]{2}/.test(body.textContent),'System prose fully localized outside original and diagnostic boundaries: '+assetClass+' '+locale);
   doc.window.close();
  }
  ok(JSON.stringify(report)===encoded&&verifyPersonalSectorResearchReport(report),'Rendering never mutates report or digest');
  ok(JSON.stringify(calculatePersonalSectorCase(state))===JSON.stringify(report.result)&&JSON.stringify(state)===before,'Locale cannot change calculations or source inputs');
  ok(!report.result.professionalValuationCertified&&!report.result.transactionAuthorized&&!report.independentlyVerified,'No professional or transaction authority from translated research');
 }
 const dom=new JSDOM('<div id="root"></div>',{url:'https://synthetic.invalid/'});global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true;
 const cryptoDescriptor=Object.getOwnPropertyDescriptor(global,'crypto');Object.defineProperty(global,'crypto',{value:webcrypto,configurable:true});
 const downloads=[],oldCreate=URL.createObjectURL,oldRevoke=URL.revokeObjectURL;URL.createObjectURL=blob=>{downloads.push(blob);return 'blob:synthetic';};URL.revokeObjectURL=()=>{};dom.window.HTMLAnchorElement.prototype.click=function(){};
 const {transformWithOxc}=await import('vite');
 async function load(name){
  const file=path.resolve(__dirname,'../../src/components',name+'.jsx');let source=fs.readFileSync(file,'utf8');
  source=source.replace(/^import React(?:,\s*\{([^}]+)\})? from 'react';$/gm,(_,hooks)=>'const React=require("react");'+(hooks?'const {'+hooks+'}=React;':''));
  source=source.replace(/^import \{([^}]+)\} from 'react';$/gm,(_,hooks)=>'const {'+hooks+'}=require("react");');
  const main=source.match(/export default function (\w+)/)[1];source=source.replace('export default function ','function ');
  const {code}=await transformWithOxc(source,file,{jsx:{runtime:'classic'}}),module={exports:{}};
  new Function('require','module','exports',code+'\nmodule.exports='+main+';')(createRequire(file),module,module.exports);return module.exports;
 }
 const Sector=await load('PersonalSectorValuationWorkbench'),Limited=await load('PersonalLimitedInterestDcfPanel'),Phased=await load('PersonalPhasedDevelopmentDcfPanel'),Readiness=await load('PersonalResearchReadinessPanel');
 let locale='en',assetClass='OFFICE';const root=createRoot(document.getElementById('root'));
 const render=()=>React.act(async()=>root.render(React.createElement(React.StrictMode,null,React.createElement(Sector,{locale,assetClass}),React.createElement(Limited,{locale,assetClass}),React.createElement(Phased,{locale}),React.createElement(Readiness,{locale,validationError:true}))));
 const byId=id=>document.querySelector('[data-testid="'+id+'"]'),city=()=>byId('personal-sector-workbench').querySelector('input');
 const click=id=>React.act(async()=>Simulate.click(byId(id))),change=(node,value)=>React.act(async()=>Simulate.change(node,{target:{value,checked:value}}));
 const choose=file=>React.act(async()=>{Simulate.change(byId('personal-sector-import-case'),{target:{files:[file],value:file.name}});await Promise.resolve();});
 const file=(text,pending)=>({name:'synthetic.json',size:bytes(text).byteLength,arrayBuffer:()=>pending?.promise||Promise.resolve(bytes(text))});
 const settle=(d,value,reject=false)=>React.act(async()=>{reject?d.reject(value):d.resolve(value);await Promise.resolve();});
 const until=async(fn)=>{const end=Date.now()+5000;do{await React.act(async()=>new Promise(r=>setTimeout(r,10)));if(fn())return;}while(Date.now()<end);throw Error('Deferred WebCrypto operation did not finish');};
 await render();
 ok(byId('limited-interest-annualPropertyIncomeSar').closest('label').textContent.includes('before OPEX, ground rent and maintenance'),'Actual English rights income field excludes OPEX, ground rent and maintenance before calculating NOI');
 await click('personal-sector-calculate');
 ok(byId('personal-sector-reasons').textContent.includes('Enter the city'),'English sector HOLD has a human explanation, not code only');
 ok(byId('personal-research-reasons').textContent.includes('Current inputs are invalid'),'English financial integrity reason is readable');
 await click('limited-interest-calculate');
 ok(byId('limited-interest-reasons').textContent.includes('Select a leasehold or usufruct right'),'English limited-right HOLD is readable');
 // The phased calculate button has a stable existing test id.
 const phasedButton=[...byId('personal-phased-development-dcf').querySelectorAll('button')].at(-1);await React.act(async()=>Simulate.click(phasedButton));
 ok(byId('phased-development-reasons').textContent.includes('Enter a valid valuation date'),'English phased development HOLD is readable');
 const codes=[...byId('personal-sector-reasons').querySelectorAll('code')].map(x=>x.textContent);locale='ar-SA';await render();
 ok(byId('limited-interest-annualPropertyIncomeSar').closest('label').textContent.includes('الإيراد العقاري السنوي قبل مصروفات التشغيل وأجرة الحق والصيانة'),'Actual Arabic rights field retains gross income boundary');
 ok(byId('personal-sector-reasons').textContent.includes('حدد المدينة')&&JSON.stringify([...byId('personal-sector-reasons').querySelectorAll('code')].map(x=>x.textContent))===JSON.stringify(codes),'Arabic roundtrip keeps exact held result and codes');
 await choose({name:'oversize.json',size:200000});ok(byId('personal-sector-archive-status').textContent.includes('حجم الملف'),'Arabic size rejection');locale='en';await render();ok(byId('personal-sector-archive-status').textContent.includes('oversized'),'Prior rejection follows locale without another read');
 const archived=await createPersonalSectorCaseArchive(fixture('OFFICE','SYNTH-ARCHIVE'),{subtle:webcrypto.subtle}),text=JSON.stringify(archived);
 const edited=defer();await choose(file(text,edited));await change(city(),'SYNTH-EDIT');await settle(edited,bytes(text));
 ok(city().value==='SYNTH-EDIT'&&!byId('personal-sector-archive-status'),'Pending import cannot overwrite new inputs');
 const prior=defer();await choose(file(text,prior));const latest=await createPersonalSectorCaseArchive(fixture('OFFICE','SYNTH-LATEST'),{subtle:webcrypto.subtle});await choose(file(JSON.stringify(latest)));await until(()=>city().value==='SYNTH-LATEST');const latestNotice=byId('personal-sector-archive-status').textContent;await settle(prior,Error('SYNTH_OLD_FAILURE'),true);
 ok(city().value==='SYNTH-LATEST'&&byId('personal-sector-archive-status').textContent===latestNotice,'Latest verified file wins; older error cannot replace its success');
 locale='ar-SA';await render();ok(byId('personal-sector-archive-status').textContent.includes('استُعيدت المدخلات'),'Completed import notice follows current Arabic locale');
 const sectorWait=defer();await choose(file(text,sectorWait));assetClass='RETAIL';await render();await settle(sectorWait,bytes(text));ok(city().value===''&&!byId('personal-sector-archive-status'),'Sector change clears case and cancels earlier file');
 assetClass='OFFICE';await render();const localeWait=defer();await choose(file(text,localeWait));locale='en';await render();await settle(localeWait,bytes(text));await until(()=>city().value==='SYNTH-ARCHIVE');
 ok(byId('personal-sector-archive-status').textContent.includes('Inputs only restored'),'Changing locale alone preserves valid import and uses current-language completion');
 const digestWait=defer();Object.defineProperty(global,'crypto',{value:{subtle:{digest:async(...args)=>{const actual=await webcrypto.subtle.digest(...args);await digestWait.promise;return actual;}}},configurable:true});
 await click('personal-sector-export-case');await change(city(),'SYNTH-EXPORT-EDIT');await settle(digestWait);await React.act(async()=>new Promise(r=>setImmediate(r)));
 ok(downloads.length===0&&!byId('personal-sector-archive-status'),'An edited case cannot download an old pending archive');
 Object.defineProperty(global,'crypto',{value:webcrypto,configurable:true});const unmounted=defer();await choose(file(text,unmounted));await React.act(async()=>root.unmount());await settle(unmounted,bytes(text));ok(document.getElementById('root').childElementCount===0,'No old completion after unmount');
 dom.window.close();if(cryptoDescriptor)Object.defineProperty(global,'crypto',cryptoDescriptor);URL.createObjectURL=oldCreate;URL.revokeObjectURL=oldRevoke;
 console.log('PERSONAL_RESEARCH_LOCALE_AND_SCOPE_D04=PASS checks='+checks+' sectors=13 realMarketOrExternalApproval=false');
})().catch(error=>{console.error(error);process.exitCode=1;});

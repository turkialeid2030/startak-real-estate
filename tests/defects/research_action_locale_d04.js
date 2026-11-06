'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const React=require('react');
const {JSDOM}=require('jsdom');
const {createRoot}=require('react-dom/client');
const {Simulate}=require('react-dom/test-utils');
const {valuationEvidenceLabel}=require('../../src/i18n/valuation-evidence-presentation');
const {researchActionText}=require('../../src/i18n/research-action-presentation');
const {coreMarketLabel}=require('../../src/i18n/market-study-core-labels');
const marketLabels=require('../../src/i18n/market-workflow-labels');
const contracts=require('../../src/valuation-intelligence');
let checks=0;const ok=(value,message)=>{assert.ok(value,message);checks++;};

(async()=>{
 for(const group of ['EVIDENCE_GRADE','INPUT_STATUS','BASIS_OF_VALUE','TRANSACTION_STATUS','WEIGHTING_POLICY']){
  const original=JSON.stringify(contracts[group]);
  for(const code of Object.values(contracts[group])){
   const ar=valuationEvidenceLabel(code,'ar-SA'),en=valuationEvidenceLabel(code,'en');
   ok(ar!==code&&/[\u0600-\u06ff]/.test(ar),'Arabic option '+code);
   ok(en!==code&&!/[\u0600-\u06ff]/.test(en),'English option '+code);
  }
  ok(JSON.stringify(contracts[group])===original,'Presentation cannot mutate '+group);
 }
 ok(valuationEvidenceLabel('SOURCE_UNKNOWN','en')==='SOURCE_UNKNOWN','Unknown code preserved');
 for(const [ar,en] of Object.entries(marketLabels)){
  ok(coreMarketLabel(ar,'en')===en,'English workflow label '+ar);
  ok(coreMarketLabel(ar,'ar-SA')===ar,'Arabic workflow label unchanged');
 }
 ok(coreMarketLabel('  لا شيء  ','en')==='  None  ','Whitespace around translated text preserved');
 const notice={kind:'SIDECAR_SAVED',params:{dealId:'صفقة-HOLD/<script>'}};
 const originalNotice=JSON.stringify(notice);
 ok(researchActionText(notice,'en').includes('صفقة-HOLD/<script>'),'Source identifier is not translated');
 ok(researchActionText(notice,'ar-SA').includes('صفقة-HOLD/<script>'),'Source identifier preserved in Arabic');
 ok(JSON.stringify(notice)===originalNotice,'Notice source parameters immutable');
 ok(researchActionText({kind:'RESEARCH_HTML_EN'},'ar-SA').includes('إنجليزي'),'Arabic UI correctly describes an earlier English file');
 ok(researchActionText({kind:'RESEARCH_HTML_AR'},'en').includes('Arabic'),'English UI correctly describes an earlier Arabic file');
 ok(researchActionText({kind:'CSV_IMPORTED',params:{count:3,skipped:1}},'en').includes('3 records; 1'),'Import counts preserved');
 ok(researchActionText({kind:'STUDY_EXPORT_BLOCKED'},'en').includes('blocked'),'Linked audit export blocker remains a blocker');
 ok(!researchActionText({kind:'UNKNOWN'},'en').includes('success'),'Unknown notice cannot imply success');

 const dom=new JSDOM('<div id="root"></div>',{url:'https://synthetic.invalid/'});
 global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true;
 const {transformWithOxc}=await import('vite');const cache=new Map();
 async function load(file){
  file=path.resolve(file);if(cache.has(file))return cache.get(file);
  let source=fs.readFileSync(file,'utf8');
  const imports=[...source.matchAll(/^import ([\s\S]*?) from ['"]([^'"]+)['"];$/gm)];
  const resolutions=new Map();
  for(const m of imports){if(m[2].startsWith('.')){
   let dependency=path.resolve(path.dirname(file),m[2]);if(!path.extname(dependency))dependency+='.jsx';
   resolutions.set(m[2],dependency);await load(dependency);
  }}
  const main=source.match(/export default function (\w+)/)?.[1];
  const named=[...source.matchAll(/export function (\w+)/g)].map(m=>m[1]);
  for(const m of imports){
   const target='require('+JSON.stringify(m[2])+')';let statement;
   if(m[1].startsWith('React'))statement='const React='+target+';'+(m[1].includes('{')?'const '+m[1].slice(m[1].indexOf('{'))+'=React;':'');
   else if(m[1].startsWith('{'))statement='const '+m[1]+'='+target+';';
   else statement='const '+m[1]+'='+target+'.default;';
   source=source.replace(m[0],statement);
  }
  source=source.replaceAll('export default function ','function ').replaceAll('export function ','function ');
  const {code}=await transformWithOxc(source,file,{jsx:{runtime:'classic'}});
  const native=createRequire(file),module={exports:{}};
  const localRequire=id=>resolutions.has(id)?cache.get(resolutions.get(id)):native(id);
  new Function('require','module','exports',code+'\nmodule.exports={'+named.join(',')+(main&&named.length?',':'')+(main?'default:'+main:'')+'};')(localRequire,module,module.exports);
  cache.set(file,module.exports);return module.exports;
 }
 const component=name=>load(path.resolve(__dirname,'../../src/components',name+'.jsx'));
 const Advanced=(await component('ValuationAdvancedPanel')).default;
 const Critical=(await component('CriticalEvidenceRequirementsPanel')).default;
 const initial={schemaVersion:1,projectId:'SYNTH-D04',classification:{},incomePolicy:{},
  criticalEvidenceRequirements:{INCOME_DIRECT_CAPITALIZATION:[{field:'effectiveGrossIncome',allowedGrades:['H_CLIENT_SUPPLIED_UNVERIFIED'],allowedStatuses:['UNVERIFIED']}]}};
 let state,setCase,setLanguage;let applied=0;
 function Harness(){const [valuationCase,update]=React.useState(initial);const [locale,language]=React.useState('ar-SA');state=valuationCase;setCase=update;setLanguage=language;const props={locale,valuationCase,onChangeValuationCase:next=>{applied++;update(next);}};return React.createElement(React.Fragment,null,React.createElement(Advanced,props),React.createElement(Critical,props));}
 const root=createRoot(document.getElementById('root'));
 await React.act(async()=>root.render(React.createElement(Harness)));
 const byId=id=>document.querySelector('[data-testid="'+id+'"]');
 const click=node=>React.act(async()=>Simulate.click(node));
 const change=(node,value)=>React.act(async()=>Simulate.change(node,{target:{value,checked:value}}));
 const advanced=byId('valuation-advanced-editor'),critical=byId('critical-evidence-editor');
 await click(advanced.querySelector('button'));await click(critical.querySelector('button'));
 await click([...advanced.querySelectorAll('button')].at(-1));
 ok(byId('valuation-advanced-status')?.textContent.includes('تم تطبيق'),'Success remains visible after actual parent state update');
 const afterApply=JSON.stringify(state),beforeCount=applied;
 await React.act(async()=>setLanguage('en'));
 ok(byId('valuation-advanced-status')?.textContent.includes('were applied'),'Stored successful action follows English locale');
 ok(JSON.stringify(state)===afterApply&&applied===beforeCount,'Language switch never reapplies settings');
 const checkbox=advanced.querySelector('input[type=checkbox]');await change(checkbox,true);
 await click([...advanced.querySelectorAll('button')].at(-1));
 ok(byId('valuation-advanced-status')?.textContent.includes('could not be applied'),'Invalid enabled evidence is blocked');
 const errorCode=byId('valuation-advanced-status').querySelector('code')?.textContent;
 await React.act(async()=>setLanguage('ar-SA'));
 ok(byId('valuation-advanced-status')?.textContent.includes('تعذر تطبيق'),'Stored failure follows Arabic locale');
 ok(byId('valuation-advanced-status').querySelector('code')?.textContent===errorCode,'Diagnostic code unchanged');
 const grade=critical.querySelector('input[value="H_CLIENT_SUPPLIED_UNVERIFIED"]');
 ok(grade.checked,'Existing unverified grade remains selected');await change(grade,false);
 await click([...critical.querySelectorAll('button')].at(-1));
 ok(byId('critical-evidence-status')?.textContent.includes('تعذر تطبيق'),'Missing allowed grade remains blocked');
 const selected=()=>[...critical.querySelectorAll('input,select')].map(x=>({value:x.value,checked:x.checked}));
 const selectedBefore=JSON.stringify(selected());await React.act(async()=>setLanguage('en'));
 ok(byId('critical-evidence-status')?.textContent.includes('could not be applied'),'Critical failure follows English locale');
 ok(JSON.stringify(selected())===selectedBefore,'Every critical field and checkbox survives locale switch');
 ok(critical.textContent.includes('Unverified client-supplied data'),'Unverified grade label is readable');
 await change(grade,true);await click([...critical.querySelectorAll('button')].at(-1));
 ok(byId('critical-evidence-status')?.textContent.includes('were applied'),'Critical success visible after parent update');
 ok(!byId('valuation-advanced-status'),'Applying another configuration hides stale prior result');
 ok(state.criticalEvidenceRequirements.INCOME_DIRECT_CAPITALIZATION[0].allowedGrades[0]==='H_CLIENT_SUPPLIED_UNVERIFIED','No evidence upgrade on apply or translation');
 await React.act(async()=>setCase({...state,projectId:'OTHER-SYNTHETIC-CASE'}));
 ok(!byId('critical-evidence-status'),'Switching case hides a prior successful action synchronously');
 await React.act(async()=>root.unmount());dom.window.close();
 console.log('D04_RESEARCH_ACTION_LOCALE=PASS checks='+checks);
})().catch(error=>{console.error(error);process.exitCode=1;});

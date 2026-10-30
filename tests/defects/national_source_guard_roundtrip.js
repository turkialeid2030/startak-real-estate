'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const React=require('react'),{JSDOM}=require('jsdom'),{createRoot}=require('react-dom/client'),{Simulate}=require('react-dom/test-utils');
const {LocaleProvider,useLocale}=require('../../src/i18n/LocaleContext');
const {SOURCES}=require('../../src/market/saudi-national-intelligence-sources');
const {MAX_CSV_BYTES}=require('../../src/market/public-dataset-import');
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;};
(async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://synthetic.invalid/'});
 global.window=dom.window;global.document=dom.window.document;global.NodeFilter=dom.window.NodeFilter;
 global.MutationObserver=dom.window.MutationObserver;global.IS_REACT_ACT_ENVIRONMENT=true;
 const {transformWithOxc}=await import('vite');
 async function load(name){
  const file=path.resolve(__dirname,'../../src/components',name+'.jsx');let source=fs.readFileSync(file,'utf8');
  const main=source.match(/export default function (\w+)/)[1];
  source=source.replace(/^import React(?:,\s*\{([^}]+)\})? from 'react';$/gm,(_,hooks)=>'const React=require("react");'+(hooks?'const {'+hooks+'}=React;':''));
  source=source.replaceAll('export default function ','function ').replace(/^export \{[^}]+\};$/gm,'');
  const {code}=await transformWithOxc(source,file,{jsx:{runtime:'classic'}}),module={exports:{}};
  new Function('require','module','exports',code+'\nmodule.exports='+main+';')(createRequire(file),module,module.exports);return module.exports;
 }
 const Panel=await load('SaudiNationalIntelligenceSourcesPanel'),Guard=await load('StrictArabicSurfaceGuard');
 let setLocale;function Control(){setLocale=useLocale().setLocale;return null;}
 const root=createRoot(document.getElementById('root'));
 await React.act(async()=>root.render(React.createElement(LocaleProvider,null,React.createElement(Control),React.createElement(Panel),React.createElement(Guard))));
 const byId=id=>document.querySelector('[data-testid="'+id+'"]');
 const options=()=>[...byId('national-source-filter').options].slice(1);
 const original=JSON.stringify(SOURCES);
 function checkSourceNames(){
  ok(!document.body.textContent.includes('نص يحتاج استكمال التعريب؛ الأصل:'),'Actual Arabic surface guard has no unmapped source-name prose');
  ok(options().length===SOURCES.length,'Every registered source remains selectable');
  for(const [i,source]of SOURCES.entries()){
   const option=options()[i];ok(option.value===source.id&&option.textContent===source.label,'Source option preserves identifier and original name: '+source.id);
   ok(option.hasAttribute('data-user-content')&&option.getAttribute('translate')==='no','Source option has explicit original-content boundary: '+source.id);
   const link=byId('national-sources-links').querySelectorAll('a')[i];
   ok(link.getAttribute('href')===source.url&&link.textContent.trim()===source.label,'Original source URL and label unchanged: '+source.id);
  }
 }
 checkSourceNames();
 await React.act(async()=>Simulate.change(byId('national-import-csv'),{target:{files:[{size:MAX_CSV_BYTES+1}],value:'synthetic.csv'}}));
 ok(byId('national-import-status').textContent.includes('حجم الملف أكبر'),'Arabic size rejection visible');
 const before=options().map(x=>[x.value,x.textContent]);
 await React.act(async()=>setLocale('en'));
 ok(byId('national-import-status').textContent.includes('exceeds allowed size'),'Prior rejection follows English without another file read');
 ok(JSON.stringify(options().map(x=>[x.value,x.textContent]))===JSON.stringify(before),'Language switch never rewrites original provider labels or values');
 await React.act(async()=>setLocale('ar-SA'));checkSourceNames();
 ok(JSON.stringify(SOURCES)===original,'Presentation never mutates provider registry');
 await React.act(async()=>root.unmount());dom.window.close();
 console.log('NATIONAL_SOURCE_GUARD_ROUNDTRIP=PASS checks='+checks);
})().catch(e=>{console.error(e);process.exitCode=1;});

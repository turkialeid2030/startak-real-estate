'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const React=require('react'),{createRoot}=require('react-dom/client'),{JSDOM}=require('jsdom');
const {LocaleProvider,useLocale}=require('../../src/i18n/LocaleContext');
let checks=0;const ok=(value,message)=>{assert.ok(value,message);checks++;};
(async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://synthetic.invalid/'});
 Object.assign(global,{window:dom.window,document:dom.window.document,NodeFilter:dom.window.NodeFilter,MutationObserver:dom.window.MutationObserver,IS_REACT_ACT_ENVIRONMENT:true});
 const file=path.resolve(__dirname,'../../src/components/StrictArabicSurfaceGuard.jsx');
 let source=fs.readFileSync(file,'utf8').replace("import React, { useEffect } from 'react';","const React=require('react'),{useEffect}=React;")
 .replace('export default function ','function ').replace(/export \{[^}]+\};/,'');
 const {transformWithOxc}=await import('vite');const {code}=await transformWithOxc(source,file,{jsx:{runtime:'classic'}}),module={exports:{}};
 new Function('require','module','exports',code+'\nmodule.exports=StrictArabicSurfaceGuard;')(createRequire(file),module,module.exports);
 const Guard=module.exports;let setLocale;
 function Fixture(){const ctx=useLocale();setLocale=ctx.setLocale;return React.createElement(React.Fragment,null,
  React.createElement(Guard),React.createElement('p',{id:'static'},'Residential Income Acquisition Intelligence'),
  React.createElement('p',{id:'changed'},ctx.locale==='en'?'New review text':'HOLD'),
  React.createElement('input',{id:'input',placeholder:'WS-...',defaultValue:'اسم المستخدم / original'}),
  React.createElement('span',{'data-user-content':true,id:'source'},'اسم المصدر الأصلي / HOLD'),
  React.createElement('code',{id:'code'},'LEGACY_DERIVED'),React.createElement('p',{id:'unknown'},'UNMAPPED_TEST_CODE'))}
 const root=createRoot(document.getElementById('root'));
 const flush=async action=>React.act(async()=>{action();await Promise.resolve();});
 const el=id=>document.getElementById(id);
 await flush(()=>root.render(React.createElement(LocaleProvider,null,React.createElement(Fixture))));
 ok(el('static').textContent.includes('تحليل'),'Static English translated by real DOM guard');
 ok(el('input').placeholder.includes('معرّف'),'Static placeholder translated');
 ok(el('unknown').textContent.includes('نص يحتاج استكمال التعريب'),'Unknown text remains visibly incomplete');
 await flush(()=>setLocale('en'));
 ok(el('static').textContent==='Residential Income Acquisition Intelligence','English restores original static text');
 ok(el('input').placeholder==='WS-...','English restores original static attribute');
 ok(el('changed').textContent==='New review text','Cleanup retains newer React content');
 ok(el('unknown').textContent==='UNMAPPED_TEST_CODE','Cleanup restores original unknown code');
 ok(el('input').value==='اسم المستخدم / original','Locale switching preserves input state');
 ok(el('source').textContent==='اسم المصدر الأصلي / HOLD'&&el('code').textContent==='LEGACY_DERIVED','Source content and code unchanged');
 await flush(()=>setLocale('ar-SA'));ok(el('static').textContent.includes('تحليل'),'Repeated Arabic transition remains active');
 el('static').textContent='Replacement after last guard mutation';
 await flush(()=>setLocale('en'));ok(el('static').textContent==='Replacement after last guard mutation','Cleanup cannot restore over a newer value');
 await flush(()=>root.unmount());dom.window.close();
 console.log('D04_ARABIC_GUARD_LOCALE_RESTORE=PASS checks='+checks);
})().catch(e=>{console.error(e);process.exitCode=1;});

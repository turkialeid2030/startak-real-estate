'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module'),{JSDOM}=require('jsdom'),React=require('react'),{createRoot}=require('react-dom/client'),{Simulate}=require('react-dom/test-utils');
const {operatingCase}=require('../fixtures/synthetic-collections-case');
const {recordDocumentedLeaseLifecycle}=require('../../src/residential-income-acquisition/operating-case-editor');
const {calculateOperatingMetrics}=require('../../src/residential-income-acquisition/operating-metrics');
let checks=0;const ok=v=>{assert.ok(v);checks++;},eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
(async()=>{
 const dom=new JSDOM('<div id="root"></div>');global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true;
 const {transformWithOxc}=await import('vite');
 async function load(name){
  const file=path.resolve(__dirname,'../../src/components/'+name+'.jsx');
  let source=fs.readFileSync(file,'utf8').replace("import React from 'react';","const React=require('react');")
   .replace(/import \{([^}]+)\} from '\.\.\/residential-income-acquisition\/operating-case-editor';/,"const {$1}=require('../residential-income-acquisition/operating-case-editor');")
   .replace('export default function '+name,'function '+name);
  // Only presentation is substituted; actual state, guards and domain calls run.
  source=source.replace("import NumericDraftInput from './NumericDraftInput';","const NumericDraftInput=props=>React.createElement('input',props);")
   .replace("import DiagnosticText from './DiagnosticText.jsx';","const DiagnosticText=({code})=>React.createElement('span',null,code);");
  const {code}=await transformWithOxc(source,file,{jsx:{runtime:'classic'}});
  return new Function('require',code+'\nreturn '+name+';')(createRequire(file));
 }
 const Editor=await load('LeaseLifecycleEditor'),Workspace=await load('RentRollCollectionsWorkspace'),root=createRoot(document.getElementById('root')),base=operatingCase();
 const calls=[];let resolve;
 const hold=(candidate,code)=>{calls.push({candidate,code});return new Promise(done=>{resolve=done;});};
 const render=(c=base,replace=hold,dir='rtl')=>React.act(async()=>root.render(React.createElement(Editor,{operatingCase:c,onReplaceOperatingCase:replace,dir})));
 const query=id=>document.querySelector('[data-testid="'+id+'"]');
 const change=async(id,value)=>React.act(async()=>Simulate.change(query(id),{target:{value,checked:value}}));
 const submit=()=>query('lease-lifecycle-editor').querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
 const draft=async()=>{for(const[id,value]of Object.entries({'lifecycle-lease':'LEASE-1','lifecycle-date':'2026-11-16','lifecycle-source':'synthetic-end','lifecycle-review':'synthetic-review','lifecycle-reason':'Document checked'}))await change(id,value);await change('lifecycle-confirm',true);};
 await render();await draft();await change('lifecycle-reason','Changed reason');eq(query('lifecycle-confirm').checked,false);await change('lifecycle-confirm',true);
 await React.act(async()=>{submit();submit();});eq(calls.length,1);ok(query('lease-lifecycle-editor').querySelector('fieldset').disabled);eq(calls[0].candidate.leases[0].changeLog.length,1);eq(calls[0].code,'LEASE_UPDATED');
 await React.act(async()=>resolve({ok:false,code:'SYNTHETIC_REJECTION'}));eq(query('lifecycle-feedback').dataset.code,'SYNTHETIC_REJECTION');ok(!query('lease-lifecycle-editor').querySelector('fieldset').disabled);eq(base.leases[0].endDate,'2027-01-01');
 const changed=recordDocumentedLeaseLifecycle(base,{action:'EARLY_END',leaseId:'LEASE-1',date:'2026-12-01',sourceRef:'other-source',adoptionDecisionRef:'other-review',reason:'Other reviewed change',confirmed:true});
 await render(changed);await React.act(async()=>submit());eq(calls.length,1);eq(query('lifecycle-feedback').dataset.code,'LEASE_LIFECYCLE_DRAFT_STALE');
 await React.act(async()=>query('lifecycle-clear').click());await render(base,async candidate=>{calls.push({candidate});return {ok:true};});await draft();await React.act(async()=>submit());eq(calls.length,2);eq(query('lifecycle-feedback').dataset.code,'LEASE_LIFECYCLE_SAVED');eq(query('lifecycle-lease').value,'');
 await render(base,async()=>{throw Error('SYNTHETIC_THROW');},'en');await draft();await React.act(async()=>submit());eq(query('lifecycle-feedback').dataset.code,'SYNTHETIC_THROW');ok(document.body.textContent.includes('Save failed; review inputs and sources.'));
 const labels={};const t=key=>labels[key]||key;
 const workspace=c=>React.act(async()=>root.render(React.createElement(Workspace,{operatingCase:c,metrics:calculateOperatingMetrics(c),t,dir:'rtl',onReplaceOperatingCase:async candidate=>{calls.push({candidate});return {ok:true};}})));
 await workspace(base);const forms=()=>[...document.querySelectorAll('form')];
 const oldChange=async(el,value)=>React.act(async()=>Simulate.change(el,{target:{value,checked:value}}));
 const first=forms()[0];await oldChange(first.querySelector('select'),'LEASE-1');
 for(const[name,value]of Object.entries({'riai.leaseBaseRent':'1200000','riai.leaseEnd':'2026-12-01','riai.sourceRef':'old-document','riai.adoptionRef':'old-review'})){
  const input=first.querySelector('[aria-label="'+name+'"]');if(input)await oldChange(input,value);
 }
 const controls=[...first.querySelectorAll('input')];for(const input of controls){if(input.type==='checkbox')await oldChange(input,true);else if(input.type==='date')await oldChange(input,'2026-12-01');else if(!input.value)await oldChange(input,'synthetic-reference');}
 await workspace(changed);const count=calls.length;await React.act(async()=>forms()[0].dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));eq(calls.length,count);ok(document.body.textContent.includes('تغيرت الحالة منذ بدء المسودة'));
 await React.act(async()=>root.unmount());dom.window.close();console.log('LEASE_LIFECYCLE_REACT=PASS checks='+checks);
})().catch(error=>{console.error(error);process.exitCode=1;});

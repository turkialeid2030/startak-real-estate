'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module');
const {JSDOM}=require('jsdom'),React=require('react'),{createRoot}=require('react-dom/client');
const {operatingCase}=require('../fixtures/synthetic-collections-case');
const {appendReceivablesEvent}=require('../../src/residential-income-acquisition/receivables-ledger');
const {calculateReceivablesPeriodReconciliation}=require('../../src/residential-income-acquisition/receivables-period-reconciliation');
(async()=>{
 const dom=new JSDOM('<div id="root"></div>');global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true;
 const {transformWithOxc}=await import('vite'),file=path.resolve(__dirname,'../../src/components/ReceivablesPeriodReconciliation.jsx');
 const source=fs.readFileSync(file,'utf8').replace("import React from 'react';",'').replace('export default function ','function ');
 const {code}=await transformWithOxc(source,file,{jsx:{runtime:'classic'}});
 const Component=new Function('React','require',code+'\nreturn ReceivablesPeriodReconciliation;')(React,createRequire(file));
 const root=createRoot(document.getElementById('root'));
 let c=operatingCase({collections:[]});
 c=appendReceivablesEvent(c,{id:'R',type:'RECEIPT',date:'2026-08-01',leaseId:'LEASE-1',amount:'١٢٠٫٥٠',reference:'receipt',sourceRef:'<source>',reviewRef:'review',confirmed:true});
 c=appendReceivablesEvent(c,{id:'X',type:'REVERSAL',date:'2026-08-20',targetId:'R',reason:'Later correction',sourceRef:'later source',reviewRef:'later review',confirmed:true});
 const result=calculateReceivablesPeriodReconciliation(c,{periodStart:'2026-08-01',periodEndExclusive:'2026-08-15'});
 for(const locale of ['ar-SA','en']){
  await React.act(async()=>root.render(React.createElement(Component,{result,locale})));
  assert.equal(document.querySelector('[data-testid="receivables-period-CLOSING-unallocated"]').textContent,'120.50');
  assert.equal(document.querySelector('[data-testid="receivables-period-RESIDUAL-unpaid"]').textContent,'0.00');
  assert(document.querySelector('[data-testid="receivables-period-later-corrections"]').textContent.includes(locale==='en'?'Later corrections':'تصحيحات'));
  assert(document.body.textContent.includes('<source>'));assert.equal(document.querySelector('source'),null);
  for(const region of document.querySelectorAll('[role="region"]'))assert.equal(region.getAttribute('tabindex'),'0');
  for(const amount of document.querySelectorAll('[data-testid$="unallocated"]'))assert.equal(amount.getAttribute('dir'),'ltr');
 }
 for(const result of [null,{status:'NOT_AVAILABLE'},{status:'NEEDS_REVIEW'}]){
  await React.act(async()=>root.render(React.createElement(Component,{result})));
  assert(document.querySelector('[role="status"]'));assert.equal(document.querySelector('[data-testid="receivables-period-CLOSING-unallocated"]'),null);
 }
 await React.act(async()=>root.unmount());dom.window.close();
 console.log('RECEIVABLES_PERIOD_UI=PASS (actual React, bilingual, exact amounts, later corrections, unavailable replaces previous balances)');
})().catch(error=>{console.error(error);process.exitCode=1;});

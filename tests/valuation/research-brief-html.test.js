'use strict';
const assert=require('node:assert/strict');
const {renderResearchBriefHtml}=require('../../src/market/research-brief-html');
const {buildUnifiedResearch,researchReportBundle}=require('../../src/market/research-evidence-fusion');
let n=0;function check(label,f){f();n++;console.log('PASS '+label);}
const snapshot=buildUnifiedResearch({subject:{city:'الرياض',district:'الملقا',assetType:'LAND'},
 feeds:{},asOf:'2026-10-28'});
const brief=researchReportBundle(snapshot,{marketReport:{todayValueScenarioSar:1200000,
 estimatedAnnualNoiSar:66000},readiness:{status:'HOLD'}});
check('self-contained printable Arabic report with no professional claims',()=>{
 const h=renderResearchBriefHtml(brief);
 assert.ok(h.startsWith('<!doctype html>'));
 assert.ok(h.includes('تقرير بحث عقاري واستثماري'));
 assert.ok(h.includes('التوصية المشروطة: تعليق القرار'));
 assert.ok(h.includes('غير معتمد'));
 assert.ok(!h.includes('<script'));
});
check('professional valuation and purchase decision cannot be injected into export',()=>{
 assert.throws(()=>renderResearchBriefHtml({...brief,valuationSar:2000000}),/RESEARCH_HTML_FAIL_CLOSED/);
 assert.throws(()=>renderResearchBriefHtml({...brief,maximumPurchaseSar:1000000}),/RESEARCH_HTML_FAIL_CLOSED/);
 assert.throws(()=>renderResearchBriefHtml({...brief,investmentDecision:'BUY'}),/RESEARCH_HTML_FAIL_CLOSED/);
});
check('user-controlled property names are escaped and javascript links are omitted',()=>{
 const modified={...brief,subject:{...brief.subject,city:'<script>alert("BAD")</script>'},
  evidenceIndex:[{id:'x',origin:'t',type:'SALE_OFFER',city:'Riyadh',
   district:'X',date:'2026-01-01',url:'javascript:alert(1)'}]};
 const h=renderResearchBriefHtml(modified);
 assert.ok(h.includes('&lt;script&gt;'));
 assert.ok(!h.includes('<script>alert'));
 assert.ok(!h.includes('href="javascript:'));
});
check('linked evidence is HTTPS only and retains source URL',()=>{
 const modified={...brief,evidenceIndex:[{id:'x',origin:'REGA_REI',
  type:'OFFICIAL_AGGREGATE',city:'Riyadh',district:'Malqa',date:'2026-01-01',
  url:'https://rei.rega.gov.sa/ar'}]};
 assert.ok(renderResearchBriefHtml(modified).includes('href="https://rei.rega.gov.sa/ar"'));
});
console.log('RESEARCH_ARABIC_HTML_REPORT_TESTS='+n+'/'+n);

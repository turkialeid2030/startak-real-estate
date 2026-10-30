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
check('owner council tasks appear with explicit independent-evidence limits',()=>{
 const h=renderResearchBriefHtml(brief);
 assert.ok(h.includes('خطة المراجعة الاستثمارية المشروطة'));
 assert.ok(h.includes('مطابقة موقع العقار وصكه'));
 assert.ok(h.includes('مطابقة صفقات منفذة'));
 assert.ok(h.includes('مراجعة مهنية ومالية وقانونية مستقلة'));
 assert.ok(!h.includes('القيمة السوقية المعتمدة:'));
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
check('English report localizes headings, tasks, direction and money without changing data',()=>{
 const before=JSON.stringify(brief),html=renderResearchBriefHtml(brief,{locale:'en'});
 assert.ok(html.includes('<html lang="en" dir="ltr">'));
 assert.ok(html.includes('text-align:left'));
 assert.ok(html.includes('Conditional recommendation: hold the decision'));
 assert.ok(html.includes('1,200,000'));
 assert.ok(html.includes('Match the property location, title, parcel and plan'));
 assert.ok(html.includes('independent professional, financial and legal review'));
 assert.ok(html.includes('HOLD / NOT_AUTHORIZED'));
 assert.equal(JSON.stringify(brief),before);
});
check('both languages retain source wording and HTTPS URLs and escape untrusted values',()=>{
 const b={...brief,subject:{...brief.subject,city:'<img src=x onerror=alert(1)>'},
  evidenceIndex:[{id:'SYNTHETIC-1',origin:'اسم المصدر الأصلي',type:'OFFICIAL_AGGREGATE',
   city:'الرياض',district:'الملقا',date:'2026-01-01',url:'https://rei.rega.gov.sa/ar'}]};
 for(const locale of ['ar-SA','en']){
  const h=renderResearchBriefHtml(b,{locale});
  assert.ok(h.includes('href="https://rei.rega.gov.sa/ar"'));
  assert.ok(h.includes('اسم المصدر الأصلي'));
  assert.ok(h.includes('OFFICIAL_AGGREGATE'));
  assert.ok(h.includes('&lt;img'));
  assert.ok(!h.includes('<img'));
  assert.throws(()=>renderResearchBriefHtml({...b,valuationSar:1},{locale}),/RESEARCH_HTML_FAIL_CLOSED/);
  assert.throws(()=>renderResearchBriefHtml({...b,maximumPurchaseSar:1},{locale}),/RESEARCH_HTML_FAIL_CLOSED/);
 }
});
check('unsupported export language cannot silently select another language',()=>{
 assert.throws(()=>renderResearchBriefHtml(brief,{locale:'xx'}),/RESEARCH_HTML_LOCALE_UNSUPPORTED/);
});
console.log('RESEARCH_BILINGUAL_HTML_REPORT_TESTS='+n+'/'+n);

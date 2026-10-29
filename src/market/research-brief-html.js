'use strict';
// Self-contained bilingual research HTML. Fail closed on report authorization.
const KIND='STARTAK_RESEARCH_EVIDENCE_BRIEF_V1';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>
 ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const txt=(v,n=240)=>esc(String(v??'').slice(0,n)||'—');
function safeUrl(url){
 if(typeof url!=='string'||url.length>2000)return null;
 try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password?
  u.toString():null;}catch{return null;}
}
const {researchSourceLabel}=require('../i18n/research-source-presentation');
function renderResearchBriefHtml(bundle,{locale='ar-SA'}={}){
 if(!['ar-SA','en'].includes(locale))throw Error('RESEARCH_HTML_LOCALE_UNSUPPORTED');
 const en=locale==='en',T=(ar,english)=>en?english:ar;
 const money=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0?new Intl.NumberFormat(en?'en-US':'ar-SA',{maximumFractionDigits:2}).format(v):'—';
 if(!bundle||bundle.kind!==KIND||bundle.publishableProfessionalValuation!==false||
    bundle.valuationSar!==null||bundle.maximumPurchaseSar!==null||
    bundle.investmentDecision!=='HOLD_REQUIRES_INDEPENDENT_MARKET_AND_FINANCIAL_EVIDENCE'||
    bundle.researchStatus!=='HOLD_UNVERIFIED_PERSONAL_RESEARCH'||
    !bundle.subject||!bundle.studySummary||!Array.isArray(bundle.evidenceIndex)||
    bundle.evidenceIndex.length>100||!Array.isArray(bundle.riskCodes))
  throw Error('RESEARCH_HTML_FAIL_CLOSED');
 const scenario=bundle.scenarioAnnex||{},open=bundle.openDataAnnex||{};
 const stats=bundle.studySummary,rows=Array.isArray(stats.feedReadiness)?stats.feedReadiness:[];
 const table=(head,body)=>'<table><thead><tr>'+head.map(x=>'<th>'+esc(x)+'</th>').join('')+
  '</tr></thead><tbody>'+body.join('')+'</tbody></table>';
 const dataTable=table([T('المصدر',"Source"),T('السجلات',"Rows"),T('طريقة الجمع',"Collection method"),T('الاتصال المباشر',"Direct connection")],
  rows.map(x=>'<tr><td>'+txt(x.feed)+'</td><td>'+money(x.importedResearchRows)+
   '</td><td>'+txt(x.mode)+T('</td><td>غير متصل</td></tr>',"</td><td>Not connected</td></tr>")));
 const scenarioTable=table([T('البند',"Item"),T('المبلغ / ريال',"Amount / SAR")],[
  [T('مؤشر المبيعات التصوري',"Sale indication scenario"),scenario.previewValuesSar?.saleIndicationSar],
  [T('مؤشر الدخل التصوري',"Income indication scenario"),scenario.previewValuesSar?.incomeIndicationSar],
  [T('سيناريو القيمة الناتجة من المدخلات',"Value scenario from entered inputs"),scenario.previewValuesSar?.todayValueScenarioSar],
  [T('صافي الدخل التشغيلي التصوري',"Net operating income scenario"),scenario.previewValuesSar?.estimatedAnnualNoiSar],
 ].map(([name,value])=>'<tr><td>'+esc(name)+'</td><td>'+money(value)+'</td></tr>'));
 const evidenceTable=table([T('المرجع',"Reference"),T('المنصة',"Platform"),T('النوع',"Type"),T('الموقع',"Location"),T('التاريخ',"Date"),T('رابط المصدر',"Source URL")],
  bundle.evidenceIndex.map(x=>{
   const url=safeUrl(x.url);
   return '<tr><td>'+txt(x.id,500)+'</td><td>'+txt(x.origin)+
    '</td><td>'+txt(x.type)+'</td><td>'+txt(x.city)+' / '+txt(x.district)+
    '</td><td>'+txt(x.date,18)+'</td><td>'+(url?
     '<a target="_blank" rel="noopener noreferrer" href="'+esc(url)+T('">فتح</a>',"\">Open</a>"):'—')+
    '</td></tr>';
  }));
 const risks=bundle.riskCodes.map(r=>'<li>'+txt(r,120)+'</li>').join('');
 const actions=Array.isArray(bundle.reviewerActionPlan?.tasks)?
  bundle.reviewerActionPlan.tasks.filter(x=>x&&x.status==='OPEN_NOT_INDEPENDENTLY_VERIFIED').slice(0,15):[];
 const actionList=actions.map(x=>'<li><strong>'+txt(researchSourceLabel(x.label,locale),200)+
  '</strong> — '+txt(researchSourceLabel(x.reason,locale),260)+'</li>').join('');
 const css='@page{size:A4;margin:18mm}*{box-sizing:border-box}'+
  'body{font-family:Tajawal,Tahoma,Arial,sans-serif;max-width:1050px;margin:0 auto;padding:22px;color:#172337;line-height:1.8}'+
  'h1{font-size:22px}h2{font-size:16px;margin-top:24px;border-bottom:1px solid #cbd5e1}'+
  'table{border-collapse:collapse;width:100%}th,td{border:1px solid #cbd5e1;padding:6px;text-align:'+(en?'left':'right')+';overflow-wrap:anywhere;font-size:11px}'+
  'th{background:#f1f5f9}p,li{font-size:12px}.warning{border:1px solid #a67c00;background:#fffbeb;padding:12px}'+
  '@media print{body{padding:0;max-width:none}}';
 return [
 '<!doctype html><html lang="'+(en?'en':'ar')+'" dir="'+(en?'ltr':'rtl')+'"><head><meta charset="utf-8">',
 '<meta name="viewport" content="width=device-width, initial-scale=1">',
 T('<title>STARTAK - تقرير بحث عقاري واستثماري غير معتمد</title>',"<title>STARTAK - Unverified property and investment research report</title>"),
 '<style>',css,'</style></head><body>',
 T('<header><h1>STARTAK | تقرير بحث عقاري واستثماري</h1>',"<header><h1>STARTAK | Property and investment research report</h1>"),
 T('<p>نسخة شخصية بحثية | تاريخ الدراسة: ',"<p>Personal research copy | Study date: "),txt(bundle.researchAsOf,20),
 T(' | الحالة: HOLD / غير معتمد</p></header>'," | Status: HOLD / Not certified</p></header>"),
 T('<div class="warning"><strong>الحدود:</strong> هذا تقرير بحثي تجريبي، وليس تقييمًا عقاريًا مرخصًا',"<div class=\"warning\"><strong>Limitations:</strong> Experimental research only, not a licensed property valuation"),
 T(' ولا إثباتًا لصك أو صفقة منفذة ولا تفويضًا بتنفيذ شراء أو بيع.</div>',", verified title, confirmed executed sale or authority to buy or sell.</div>"),
 T('<section><h2>الملخص التنفيذي</h2><p>المدينة: ',"<section><h2>Executive overview</h2><p>City: "),txt(bundle.subject.city),
 T(' | الحي: '," | District: "),txt(bundle.subject.district),T(' | نوع الأصل: '," | Asset type: "),txt(bundle.subject.assetType),
 T('</p><p><strong>التوصية المشروطة: تعليق القرار</strong> حتى استكمال التحقق المستقل من السوق',"</p><p><strong>Conditional recommendation: hold the decision</strong> pending independent verification of market evidence"),
 T(' والمستأجرين والدخل والمصروفات والملكية والتمويل. لا يوجد سقف شراء معتمد.</p>',", tenants, income, expenses, title and financing. No approved purchase cap.</p>"),
 T('<p>عدد سجلات البحث: ',"<p>Research rows: "),money(stats.validRows),T(' | المؤشرات المتعلقة بالحي: '," | District rows: "),
 money(stats.areaRows),T(' | التعارضات: '," | Conflicts: "),money(stats.conflictingRecords),'</p></section>',
 T('<section><h2>المناهج والنتائج الاسترشادية من المحرك الحالي</h2>',"<section><h2>Current engine methods and indicative scenarios</h2>"),
 T('<p>القيم التالية سيناريوهات حسابية قائمة على المدخلات، وليست قيمة سوقية معتمدة.</p>',"<p>These are arithmetic scenarios based on entered inputs, not certified market values.</p>"),
 scenarioTable,T('<p>حالة التقييم: ',"<p>Valuation status: "),txt(scenario.currentReadinessStatus,100),'</p></section>',
 T('<section><h2>مرجع وزارة العدل التاريخي المفتوح</h2>',"<section><h2>Historical open Ministry of Justice reference</h2>"),
 T('<p>حالة الدليل: ',"<p>Evidence status: "),txt(open.status,100),T(' | عدد المشاهدات: '," | Observations: "),money(open.transactionCount),
 T(' | وسيط المتر التاريخي للحي: '," | Historical district median: "),money(open.medianNeighborhoodSarSqm),
 T(' ريال/م²؛ ولا يمثل قيمة العقار أو صفقة فردية محققة.</p>'," SAR/sqm; this is not the property value or a verified individual sale.</p>"),
 T('<p>الفترة: ',"<p>Period: "),txt(open.sampleDateMin,15),' — ',txt(open.sampleDateMax,15),
 T(' | مصدر بيانات تاريخية مفتوحة عبر مرآة عامة، وليس اتصالًا رسميًا مباشرًا.</p></section>'," | Historical open data via a public mirror, not a direct official connection.</p></section>"),
 T('<section><h2>حالة التكامل والربط بين المنصات</h2>',"<section><h2>Source integration and connection status</h2>"),dataTable,'</section>',
 T('<section><h2>خطة المراجعة الاستثمارية المشروطة</h2>',"<section><h2>Conditional investment evidence review</h2>"),
 T('<p>المهام التالية تعالج فجوات البيانات ولا تفوض شراءً أو بيعًا أو إصدار قيمة مهنية.</p>',"<p>These tasks address evidence gaps and do not authorize trades or professional valuation.</p>"),
 '<ul>',actionList,'</ul></section>',
 T('<section><h2>التعارضات والمخاطر ومتطلبات الإغلاق</h2><ul>',"<section><h2>Conflicts, risks and closure requirements</h2><ul>"),risks,'</ul></section>',
 T('<section><h2>فهرس الأدلة والمراجع الأصلية</h2>',"<section><h2>Evidence index and original source references</h2>"),
 T('<p>جميع الصفوف لا تزال غير موثقة بصورة مستقلة ولا تعتبر صفقات بيع معتمدة.</p>',"<p>All rows remain independently unverified and are not certified executed sales. Original source wording and evidence codes are retained.</p>"),
 evidenceTable,'</section>',
 T('<footer><p>STARTAK | للاستخدام الشخصي والبحثي فقط — HOLD / NOT_AUTHORIZED</p></footer>',"<footer><p>STARTAK | Personal research only — HOLD / NOT_AUTHORIZED</p></footer>"),
 '</body></html>'
 ].join('');
}
module.exports={KIND,renderResearchBriefHtml};

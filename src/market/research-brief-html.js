'use strict';
// Self-contained Arabic research HTML. Fail closed on report authorization.
const KIND='STARTAK_RESEARCH_EVIDENCE_BRIEF_V1';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>
 ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const txt=(v,n=240)=>esc(String(v??'').slice(0,n)||'—');
const money=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0?
 new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(v):'—';
function safeUrl(url){
 if(typeof url!=='string'||url.length>2000)return null;
 try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password?
  u.toString():null;}catch{return null;}
}
function renderResearchBriefHtml(bundle){
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
 const dataTable=table(['المصدر','السجلات','طريقة الجمع','الاتصال المباشر'],
  rows.map(x=>'<tr><td>'+txt(x.feed)+'</td><td>'+money(x.importedResearchRows)+
   '</td><td>'+txt(x.mode)+'</td><td>غير متصل</td></tr>'));
 const scenarioTable=table(['البند','المبلغ / ريال'],[
  ['مؤشر المبيعات التصوري',scenario.previewValuesSar?.saleIndicationSar],
  ['مؤشر الدخل التصوري',scenario.previewValuesSar?.incomeIndicationSar],
  ['سيناريو القيمة الناتجة من المدخلات',scenario.previewValuesSar?.todayValueScenarioSar],
  ['صافي الدخل التشغيلي التصوري',scenario.previewValuesSar?.estimatedAnnualNoiSar],
 ].map(([name,value])=>'<tr><td>'+esc(name)+'</td><td>'+money(value)+'</td></tr>'));
 const evidenceTable=table(['المرجع','المنصة','النوع','الموقع','التاريخ','رابط المصدر'],
  bundle.evidenceIndex.map(x=>{
   const url=safeUrl(x.url);
   return '<tr><td>'+txt(x.id,500)+'</td><td>'+txt(x.origin)+
    '</td><td>'+txt(x.type)+'</td><td>'+txt(x.city)+' / '+txt(x.district)+
    '</td><td>'+txt(x.date,18)+'</td><td>'+(url?
     '<a target="_blank" rel="noopener noreferrer" href="'+esc(url)+'">فتح</a>':'—')+
    '</td></tr>';
  }));
 const risks=bundle.riskCodes.map(r=>'<li>'+txt(r,120)+'</li>').join('');
 const actions=Array.isArray(bundle.reviewerActionPlan?.tasks)?
  bundle.reviewerActionPlan.tasks.filter(x=>x&&x.status==='OPEN_NOT_INDEPENDENTLY_VERIFIED').slice(0,15):[];
 const actionList=actions.map(x=>'<li><strong>'+txt(x.label,200)+
  '</strong> — '+txt(x.reason,260)+'</li>').join('');
 const css='@page{size:A4;margin:18mm}*{box-sizing:border-box}'+
  'body{font-family:Tajawal,Tahoma,Arial,sans-serif;max-width:1050px;margin:0 auto;padding:22px;color:#172337;line-height:1.8}'+
  'h1{font-size:22px}h2{font-size:16px;margin-top:24px;border-bottom:1px solid #cbd5e1}'+
  'table{border-collapse:collapse;width:100%}th,td{border:1px solid #cbd5e1;padding:6px;text-align:right;overflow-wrap:anywhere;font-size:11px}'+
  'th{background:#f1f5f9}p,li{font-size:12px}.warning{border:1px solid #a67c00;background:#fffbeb;padding:12px}'+
  '@media print{body{padding:0;max-width:none}}';
 return [
 '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">',
 '<meta name="viewport" content="width=device-width, initial-scale=1">',
 '<title>STARTAK - تقرير بحث عقاري واستثماري غير معتمد</title>',
 '<style>',css,'</style></head><body>',
 '<header><h1>STARTAK | تقرير بحث عقاري واستثماري</h1>',
 '<p>نسخة شخصية بحثية | تاريخ الدراسة: ',txt(bundle.researchAsOf,20),
 ' | الحالة: HOLD / غير معتمد</p></header>',
 '<div class="warning"><strong>الحدود:</strong> هذا تقرير بحثي تجريبي، وليس تقييمًا عقاريًا مرخصًا',
 ' ولا إثباتًا لصك أو صفقة منفذة ولا تفويضًا بتنفيذ شراء أو بيع.</div>',
 '<section><h2>الملخص التنفيذي</h2><p>المدينة: ',txt(bundle.subject.city),
 ' | الحي: ',txt(bundle.subject.district),' | نوع الأصل: ',txt(bundle.subject.assetType),
 '</p><p><strong>التوصية المشروطة: تعليق القرار</strong> حتى استكمال التحقق المستقل من السوق',
 ' والمستأجرين والدخل والمصروفات والملكية والتمويل. لا يوجد سقف شراء معتمد.</p>',
 '<p>عدد سجلات البحث: ',money(stats.validRows),' | المؤشرات المتعلقة بالحي: ',
 money(stats.areaRows),' | التعارضات: ',money(stats.conflictingRecords),'</p></section>',
 '<section><h2>المناهج والنتائج الاسترشادية من المحرك الحالي</h2>',
 '<p>القيم التالية سيناريوهات حسابية قائمة على المدخلات، وليست قيمة سوقية معتمدة.</p>',
 scenarioTable,'<p>حالة التقييم: ',txt(scenario.currentReadinessStatus,100),'</p></section>',
 '<section><h2>مرجع وزارة العدل التاريخي المفتوح</h2>',
 '<p>حالة الدليل: ',txt(open.status,100),' | عدد المشاهدات: ',money(open.transactionCount),
 ' | وسيط المتر التاريخي للحي: ',money(open.medianNeighborhoodSarSqm),
 ' ريال/م²؛ ولا يمثل قيمة العقار أو صفقة فردية محققة.</p>',
 '<p>الفترة: ',txt(open.sampleDateMin,15),' — ',txt(open.sampleDateMax,15),
 ' | مصدر بيانات تاريخية مفتوحة عبر مرآة عامة، وليس اتصالًا رسميًا مباشرًا.</p></section>',
 '<section><h2>حالة التكامل والربط بين المنصات</h2>',dataTable,'</section>',
 '<section><h2>خطة المراجعة الاستثمارية المشروطة</h2>',
 '<p>المهام التالية تعالج فجوات البيانات ولا تفوض شراءً أو بيعًا أو إصدار قيمة مهنية.</p>',
 '<ul>',actionList,'</ul></section>',
 '<section><h2>التعارضات والمخاطر ومتطلبات الإغلاق</h2><ul>',risks,'</ul></section>',
 '<section><h2>فهرس الأدلة والمراجع الأصلية</h2>',
 '<p>جميع الصفوف لا تزال غير موثقة بصورة مستقلة ولا تعتبر صفقات بيع معتمدة.</p>',
 evidenceTable,'</section>',
 '<footer><p>STARTAK | للاستخدام الشخصي والبحثي فقط — HOLD / NOT_AUTHORIZED</p></footer>',
 '</body></html>'
 ].join('');
}
module.exports={KIND,renderResearchBriefHtml};

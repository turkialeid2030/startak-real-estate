'use strict';
function enteredInvestmentReturnsHtml(result,locale='ar-SA') {
  if(!result||result.status==='NOT_PROVIDED')return '';
  const en=locale==='en',t=(a,b)=>en?b:a;
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=n=>typeof n==='number'&&Number.isFinite(n)?n.toLocaleString(en?'en-US':'ar-SA',{maximumFractionDigits:2}):t('غير متاح','Unavailable');
  const heading='<h2>'+t('عائد مؤرخ من التدفقات النقدية المدخلة','Dated return from entered cash flows')+'</h2><p>'
    +t('سيناريو غير ممول وفق ACT/365.2425. يستبعد الرصيد الافتتاحي والتحصيل التاريخي والاستحقاقات والمصروف المعياري والاحتياطي والتمويل والتأمينات. مبلغ الشراء مستقل في بداية تاريخ الحالة، والبيع إن أُدخل هو صافي حصيلة صريحة. لا يتغير النموذج المجمع. المصادر والهوية والتغطية لم تتحقق مستقلًا؛ ليس اعتمادًا استثماريًا أو تقييمًا سوقيًا.',
    'Unlevered scenario under ACT/365.2425. Excludes opening balance, historical collections, accruals, normalized expenses, reserve, financing and deposits. Acquisition is a separate case-start outflow; entered sale is explicit net proceeds. Aggregate returns are unchanged. Sources, identity and coverage are not independently verified; not investment approval or market valuation.')+'</p>';
  if(result.status!=='CALCULATED_ENTERED_SCENARIO')return heading+'<p>'+t('العائد محجوب حتى استكمال مراجعة المدخلات والخطط والتصنيف.','Return withheld pending input, plan and classification review.')+' '+h(result.blockers.join(' · '))+'</p>';
  const labels={ACQUISITION:['شراء الأصل','Acquisition'],RENT_RECEIPT:['تحصيل مفترض','Assumed rent receipt'],OPERATING_PAYMENT:['دفعة تشغيل','Operating payment'],CAPITAL_PAYMENT:['دفعة رأسمالية','Capital payment'],TAX:['ضريبة مدخلة','Entered tax'],FEES:['رسوم مدخلة','Entered fee'],NET_SALE_PROCEEDS:['صافي بيع مفترض','Assumed net sale']};
  return heading+'<p>'+t('معدل الخصم المدخل','Entered discount rate')+': '+number(result.context.discountRate*100)+'% · '
    +t('صافي القيمة الحالية بالريال','Dated NPV SAR')+': '+number(result.npvSar)+' · '
    +t('العائد السنوي المؤرخ','Dated annual return')+': '+(result.xirr===null?t('غير متاح','Unavailable'):number(result.xirr*100)+'%')+'</p><p>'
    +t('مرجع افتراض الخصم','Discount assumption source')+': '+h(result.context.discountSourceRef)+' · '+t('مرجع المراجعة المحلية','Local review reference')+': '+h(result.context.reviewRef)+'</p><p>'
    +(result.exitValueIncluded?t('حصيلة البيع مدخلة صراحة، وليست قيمة سوقية متحققة.','Sale proceeds are explicitly entered, not independently verified market value.')
    :t('لا بيع أو قيمة أصل متبقية ضمن التدفقات؛ المقياس يخص التدفقات الجزئية فقط.','No sale or retained asset value is included; the metric covers partial flows only.'))+'</p>'
    +(result.xirr===null?'<p>'+h(result.xirrDiagnostics?.blockers.join(' · '))+'</p>':'')
    +'<table><thead><tr>'+[t('التاريخ','Date'),t('النوع','Type'),t('المبلغ بالريال','Amount SAR'),t('مرجع المصدر','Source reference')].map(label=>'<th>'+label+'</th>').join('')+'</tr></thead><tbody>'
    +result.flows.map(flow=>'<tr>'+[flow.date,labels[flow.kind]?.[en?1:0]||flow.kind,number(flow.amountMinor/100),flow.sourceRef].map(v=>'<td>'+h(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
}
module.exports={enteredInvestmentReturnsHtml};

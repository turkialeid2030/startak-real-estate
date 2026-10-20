'use strict';
const { formatCashMinor } = require('../residential-income-acquisition/cash-scenario');
function receivablesPeriodLabels(locale='ar-SA') {
  const w=(ar,en)=>locale==='en'?en:ar;
  return {
    title:w('تسوية المستحقات والمقبوضات خلال فترة الكشف','Receivables and receipts over the statement period'),
    scope:w('بالريال السعودي، وفق تواريخ القيود المدخلة. المستحقات مستندات وليست إيراد العقود المكتسب. التخصيص يخفض المستحق غير المسدد والقبض غير المخصص معًا دون قبض جديد. عكس القيد تصحيح مستندي وليس ردًا نقديًا. تُعاد الأرصدة من القيود السابقة لكل حد زمني؛ مطابقة الكشف تستخدم السجل المصحح الحالي وقد تختلف. لا تُجمع هذه القيم مع التحصيل الدوري أو دخل العقود أو توقع النقد. لا يثبت هذا اكتمال المصادر أو صحة كشف البنك ولا يغير عوائد الدراسة.',
      'SAR, using entered event dates. Charges are documents, not earned contract revenue. Allocation reduces unpaid charges and unallocated receipts together without new cash. Reversal is a document correction, not a cash refund. Balances are reconstructed before each cutoff; statement matching uses the currently corrected register and may differ. Do not add these values to period collection aggregates, contract accruals or cash forecasts. This does not establish source completeness or bank authenticity or change study returns.'),
    complete:w('تسوية حسابية متسقة للسجل المدخل فقط','Arithmetic bridge complete for the entered register only'),
    unavailable:w('يلزم كشف بفترة محددة وسجل قيود مدخل؛ البيانات الغائبة ليست صفرًا.','A dated statement period and entered register are required; missing data is not zero.'),
    review:w('تعذرت التسوية؛ راجع الفترة وتسلسل القيود وحدود المبالغ.','Bridge withheld; review the period, event chronology and amount bounds.'),
    later:w('توجد تصحيحات بعد نهاية الفترة تخص قيودًا سابقة؛ تُعرض أدناه للمراجعة ولا تُدمج بأثر صامت.','Later corrections affect entries before the period end; review them below. They are not silently applied to the earlier-period bridge.'),
    events:w('قيود الفترة ومراجعها','Period entries and references'),
    corrections:w('تصحيحات لاحقة تخص قيودًا قبل نهاية الفترة','Later corrections affecting entries before period end'),
    leases:w('الأرصدة حسب العقد — دون مقاصة بين العقود','Balances by lease — no cross-lease offset'),
    code:w('البند','Item'), unpaid:w('المستحق غير المسدد','Unpaid charges'), unallocated:w('القبض غير المخصص','Unallocated receipts'),
    openingUnpaid:w('المستحق الافتتاحي','Opening unpaid'), closingUnpaid:w('المستحق الختامي','Closing unpaid'),
    openingUnallocated:w('القبض غير المخصص افتتاحًا','Opening unallocated'), closingUnallocated:w('القبض غير المخصص ختامًا','Closing unallocated'),
    id:w('معرف القيد','Entry ID'), date:w('التاريخ','Date'), type:w('النوع','Type'), amount:w('مبلغ القيد الأصلي','Original entry amount'),
    lease:w('العقد','Lease'), target:w('القيد المرتبط','Related entry'), source:w('المصدر','Source'), reviewer:w('مرجع المراجعة المحلية','Local review reference'),reference:w('مرجع المستند','Document reference'),
    row:{ OPENING:w('رصيد قبل بداية الفترة','Balance before period start'), CHARGE:w('مستحقات مسجلة','Recorded charges'),
      CREDIT:w('تخفيضات موثقة','Documented credits'), RECEIPT:w('مقبوضات مسجلة','Recorded receipts'),
      REFUND:w('مبالغ مردودة مسجلة','Recorded refunds'), ALLOCATION:w('تخصيص المقبوضات','Receipt allocations'),
      REVERSAL:w('أثر عكس القيود — تصحيح لا حركة نقدية','Reversal effects — correction, no cash movement'),
      CLOSING:w('رصيد قبل نهاية الفترة غير المشمولة','Balance before exclusive period end'), RESIDUAL:w('فرق التسوية الحسابي','Arithmetic residual') },
  };
}
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const table=(heads,rows)=>'<table><thead><tr>'+heads.map(h=>'<th>'+escape(h)+'</th>').join('')+'</tr></thead><tbody>'
  +rows.map(row=>'<tr>'+row.map(v=>'<td>'+escape(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
function receivablesPeriodHtml(result,locale='ar-SA') {
  const l=receivablesPeriodLabels(locale);
  const header='<h2>'+l.title+'</h2><p>'+l.scope+'</p><p>'+escape(result?.periodStart)+' — '+escape(result?.periodEndExclusive)+'</p>';
  if(result?.status!=='ARITHMETIC_BRIDGE_COMPLETE')return header+'<p>'+(result?.status==='NEEDS_REVIEW'?l.review:l.unavailable)+'</p>';
  const entries=rows=>table([l.id,l.date,l.type,l.amount,l.lease,l.target],rows.map(e=>[e.id,e.date,l.row[e.type],formatCashMinor(e.amountMinor),e.leaseId,[...new Set([e.targetId,e.receiptId].filter(Boolean))].join(', ')||'—']))
    +table([l.id,l.reference,l.source,l.reviewer],rows.map(e=>[e.id,e.reference||'—',e.sourceRef,e.reviewRef]));
  return header+'<p>'+l.complete+'</p>'
    +table([l.code,l.unpaid,l.unallocated],result.rows.map(row=>[l.row[row.code],formatCashMinor(row.outstandingMinor),formatCashMinor(row.unallocatedMinor)]))
    +'<h3>'+l.leases+'</h3>'+table([l.lease,l.openingUnpaid,l.closingUnpaid,l.openingUnallocated,l.closingUnallocated],result.byLease.map(row=>[row.leaseId,formatCashMinor(row.openingMinor.outstandingMinor),formatCashMinor(row.closingMinor.outstandingMinor),formatCashMinor(row.openingMinor.unallocatedMinor),formatCashMinor(row.closingMinor.unallocatedMinor)]))
    +'<h3>'+l.events+'</h3>'+entries(result.eventRows)
    +(result.postPeriodCorrections.length?'<h3>'+l.corrections+'</h3><p>'+l.later+'</p>'+entries(result.postPeriodCorrections):'');
}
function bankRentReconciliationHtml(result,locale='ar-SA') {
  const w=(ar,en)=>locale==='en'?en:ar;
  const head='<h2>'+w('مطابقة الكشف مع السجل المصحح الحالي','Statement matching against the currently corrected register')+'</h2>';
  if(!result||result.status==='NOT_AVAILABLE')return head+'<p>'+w('لم يسجل كشف للمطابقة.','No statement recorded for matching.')+'</p>';
  const matchingLabels={MATCHED:w('متطابق','Matched'),UNMATCHED_BANK_ENTRY:w('حركة كشف غير مطابقة','Unmatched statement entry'),
    DIRECTION_MISMATCH:w('اختلاف الاتجاه','Direction mismatch'),AMOUNT_MISMATCH:w('اختلاف المبلغ','Amount mismatch'),DATE_MISMATCH:w('اختلاف التاريخ','Date mismatch')};
  const totals=result.totalsMinor,balances=result.balanceReconciliation;
  return head+'<p>'+w('مطابقة الحركات الإيجارية المدخلة فقط؛ لا اتصال بالبنك أو تحقق من أصالة الكشف أو الرصيد أو اكتمال الحركات.','Entered rent movements only; no bank connection or authentication of statement, balance or completeness.')+'</p>'
    +table([w('مرجع الحساب','Account reference'),w('بداية الفترة','Period start'),w('النهاية غير المشمولة','Exclusive end'),w('مرجع الكشف','Statement source'),w('مرجع المراجعة','Review reference')],[[result.accountRef,result.periodStart,result.periodEndExclusive,result.sourceRef,result.reviewRef]])
    +'<p>'+w('حالة المطابقة','Matching status')+': '+(result.status==='MATCHED_ENTERED_RENT_MOVEMENTS'?w('متطابقة للمدخلات فقط','Matched for entered data only'):w('تحتاج مراجعة','Needs review'))+'</p>'
    +table([w('حركة الكشف','Statement movement'),w('القيد','Register entry'),w('التاريخ','Date'),w('مبلغ الكشف','Statement amount'),w('مبلغ السجل','Register amount'),w('الحالة','Status')],result.rows.map(row=>[row.id,row.ledgerEventId||'—',row.date,formatCashMinor(row.amountMinor),row.ledgerAmountMinor===null?'—':formatCashMinor(row.ledgerAmountMinor),matchingLabels[row.status]||w('تحتاج مراجعة','Needs review')]))
    +(totals?table([w('إيداعات الكشف','Statement credits'),w('مردودات الكشف','Statement debits'),w('مقبوضات السجل','Register receipts'),w('مردودات السجل','Register refunds'),w('فرق الإيداعات','Credit difference'),w('فرق المردودات','Refund difference')],[[...['bankCredits','bankDebits','ledgerCredits','ledgerDebits','creditDifference','debitDifference'].map(key=>formatCashMinor(totals[key]))]]):'')
    +(Number.isSafeInteger(balances?.openingMinor)?table([w('الافتتاحي المدخل','Entered opening'),w('الختامي المدخل','Entered closing'),w('الختامي المحسوب','Calculated closing'),w('فرق الأرصدة','Balance difference')],[[...['openingMinor','closingMinor','calculatedClosingMinor','differenceMinor'].map(key=>formatCashMinor(balances[key]))]]):'<p>'+w('الأرصدة غير مدخلة — لم تُجر مطابقتها.','Balances not supplied — not reconciled.')+'</p>')
    +'<p>'+w('قيود غير مطابقة','Unmatched entries')+': '+escape(result.unmatchedLedgerIds.join(', ')||'—')+'</p>'
    +receivablesPeriodHtml(result.ledgerPeriodReconciliation,locale);
}
module.exports={receivablesPeriodLabels,receivablesPeriodHtml,bankRentReconciliationHtml};

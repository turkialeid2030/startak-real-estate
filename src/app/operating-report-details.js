'use strict';
const { describeDiagnostic } = require('../i18n/diagnostic-presentation');
const { enteredInvestmentReturnsHtml } = require('./entered-investment-returns-html');
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function operatingReportDetails(runoff, locale = 'ar-SA') {
  if (!runoff) return '';
  const ar = locale !== 'en', w = (a,b) => ar ? a : b;
  const money = x => typeof x === 'number' && Number.isFinite(x)
    ? x.toLocaleString(ar ? 'ar-SA' : 'en-US', { maximumFractionDigits: 2 }) + w(' ريال',' SAR') : w('غير متاح','Unavailable');
  const minor = x => money(Number.isSafeInteger(x) ? x / 100 : null);
  const table = (headers, rows) => '<table><thead><tr>' + headers.map(x=>'<th>'+escape(x)+'</th>').join('')
    + '</tr></thead><tbody>' + rows.map(row=>'<tr>'+row.map(x=>'<td>'+escape(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
  const history = runoff.historicalCollections, cash = runoff.cashScenario;
  const sections = [
    [w('دخل العقود','Contract accruals'), runoff],
    [w('التحصيل التاريخي','Historical collections'), history],
    [w('خطة دفعات التشغيل','Operating payment plan'), runoff.operatingPaymentPlan],
    [w('خطة الإنفاق الرأسمالي','Capital payment plan'), runoff.capitalPaymentPlan],
    [w('سيناريو النقد','Cash scenario'), cash],
  ];
  return '<h2>'+w('حالة الحساب وملاحظات التشغيل','Operating calculation status and issues')+'</h2>'
    + table([w('المسار','Component'),w('الحالة','Status'),w('الملاحظات','Issues')], sections.map(([name,section])=>[name,
      describeDiagnostic(section?.status || 'NOT_AVAILABLE',locale).message,
      (section?.issues || []).map(issue=>[describeDiagnostic(issue.code,locale).message,issue.code,issue.field,issue.refId].filter(Boolean).join(' · ')).join(' / ') || w('لا ملاحظات مسجلة لهذا المسار؛ لا يعني اعتمادًا','No recorded issues for this component; not approval')]))
    + '<h2>'+w('تحصيل تاريخي — منفصل عن توقع العقود','Historical collections — separate from contract forecast')+'</h2>'
    + table([w('المؤشر','Metric'),w('القيمة','Value')],[
      [w('بداية فترة السجلات','Record period start'),history?.reportingPeriod?.startDate || w('غير متاح','Unavailable')],
      [w('نهاية فترة السجلات','Record period end'),history?.reportingPeriod?.endDate || w('غير متاح','Unavailable')],
      [w('المستحق التعاقدي','Contractual amount due'),money(history?.totals?.contractualRentDue)],
      [w('المحصّل وفق السجلات المدخلة','Collected per entered records'),money(history?.totals?.rentCollected)],
      [w('المستحق غير المحصّل','Uncollected contractual amount'),money(history?.totals?.uncollectedContractualRent)],
      [w('تحصيل زائد يحتاج تخصيصًا','Excess collections needing allocation'),money(history?.totals?.excessCollectionsRequiringAllocation)],
    ])
    + '<h2>'+w('العقود والمصروف المعياري شهريًا','Monthly contracts and normalized expenses')+'</h2>'
    + table([w('بداية الفترة','Period start'),w('النهاية غير المشمولة','Exclusive end'),w('إيجار العقود','Contract rent'),w('المصروف المعياري','Normalized OPEX'),w('CAPEX المجدول','Scheduled CAPEX'),w('الصافي التحليلي','Analytical net')],
      (runoff.rows || []).map(row=>[row.periodStart,row.periodEndExclusive,money(row.contractRent),money(row.normalizedOpex),money(row.scheduledCapex),money(row.contractNetAfterScheduledCapex)]))
    + '<h2>'+w('النقد الشهري وفق الخطط المدخلة','Monthly cash from entered plans')+'</h2><p>'
    + w('توقع جزئي يستبعد التدفقات غير المدخلة؛ لا يثبت رصيد بنك أو قبضًا فعليًا.','Partial scenario excluding unentered flows; not a verified bank balance or executed receipt.')+'</p>'
    + table([w('بداية الفترة','Period start'),w('الافتتاحي','Opening'),w('تحصيل متوقع','Planned receipts'),w('دفعات تشغيل','Operating payments'),w('دفعات رأسمالية','Capital payments')],
      (cash?.rows || []).map(row=>[row.periodStart,...['openingMinor','receiptsMinor','operatingMinor','capexMinor'].map(key=>minor(row[key]))]))
    + table([w('بداية الفترة','Period start'),w('تدفقات أخرى داخلة','Other inflows'),w('تدفقات أخرى خارجة','Other outflows'),w('ثمن شراء الأصل','Asset acquisition'),w('صافي بيع الأصل','Net asset sale'),w('الختامي','Closing')],
      (cash?.rows || []).map(row=>[row.periodStart,...['otherInflowsMinor','otherOutflowsMinor','acquisitionMinor','assetSaleMinor','closingMinor'].map(key=>minor(['acquisitionMinor','assetSaleMinor'].includes(key)?(row[key]??0):row[key]))]))
    + table([w('فحص السيولة المحافظ','Conservative liquidity check'),w('القيمة','Value')],[
      [w('أدنى رصيد قبل تحصيل اليوم','Minimum balance before same-day receipts'),minor(cash?.liquidity?.minimumMinor)],
      [w('تاريخ أدنى رصيد','Minimum balance date'),cash?.liquidity?.minimumDate || w('غير متاح','Unavailable')],
    ]) + enteredInvestmentReturnsHtml(cash?.investmentReturns,locale);
}
module.exports = { operatingReportDetails };
